import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
import { sendEmail } from "../../lib/email";
import { paginationHelpers } from "../../helper/paginationHelpers";
import config from "../../../config";
import { ShipmentStatus, OfferStatus } from "../../../generated/prisma/enums";
import { OfferService } from "../offer/offer.service";
import { NotificationService } from "../notification/notification.service";
import { PaymentService } from "../payment/payment.service";
import { notifyAdminCountsUpdated } from "../../lib/socket";

const createTrip = async (data: any, user: User) => {
  if (data.fromCountry.toLowerCase() === data.toCountry.toLowerCase()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "From country and to country cannot be the same",
    );
  }

  const tripDate = new Date(data.flightDate);
  if (isNaN(tripDate.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid flight date format");
  }

  const result = await prisma.trip.create({
    data: {
      flightNumber: data.flightNumber,
      fromCountry: data.fromCountry,
      toCountry: data.toCountry,
      flightDate: tripDate,
      flightTime: data.flightTime,
      airportArrivalTime: data.airportArrivalTime || null,
      cabinBagCapacity: data.cabinBagCapacity,
      checkInBagCapacity: data.checkInBagCapacity,
      remainingCabinCapacity: data.cabinBagCapacity,
      remainingCheckInCapacity: data.checkInBagCapacity,
      ticketPhoto: data.ticketPhoto || null,
      userId: user.id,
      status: "PENDING",
    },
  });

  notifyAdminCountsUpdated();
  return result;
};

const getTrips = async (query: Record<string, unknown>, user: User) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);

  const where: any = {};

  // Role-based user filter
  if (query.type === "my-trips") {
    if (user.role !== "admin") {
      where.userId = user.id;
    } else if (query.userId) {
      where.userId = query.userId as string;
    }
    if (query.status) {
      where.status = query.status as string;
    }
    if (query.fromCountry) {
      where.fromCountry = {
        equals: query.fromCountry as string,
        mode: "insensitive",
      };
    }
    if (query.toCountry) {
      where.toCountry = {
        equals: query.toCountry as string,
        mode: "insensitive",
      };
    }
  } else if (user.role !== "admin") {
    // For non-admin, non-my-trips search, only return ACTIVE trips
    where.status = "ACTIVE";
    // Senders search filters
    if (query.fromCountry) {
      where.fromCountry = {
        contains: query.fromCountry as string,
        mode: "insensitive",
      };
    }
    if (query.toCountry) {
      where.toCountry = {
        contains: query.toCountry as string,
        mode: "insensitive",
      };
    }
    if (query.flightDate) {
      const searchDate = new Date(query.flightDate as string);
      if (!isNaN(searchDate.getTime())) {
        const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
        where.flightDate = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }
  } else {
    // Admin filters
    if (query.status) {
      where.status = query.status as string;
    }
    if (query.userId) {
      where.userId = query.userId as string;
    }
    if (query.searchTerm) {
      const search = query.searchTerm as string;
      where.OR = [
        { flightNumber: { contains: search, mode: "insensitive" } },
        { fromCountry: { contains: search, mode: "insensitive" } },
        { toCountry: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
        {
          user: {
            name: { contains: search, mode: "insensitive" },
          },
        },
        {
          user: {
            email: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }
  }

  const result = await prisma.trip.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      shipments: {
        include: {
          shipmentSteps: true,
        },
      },
    },
  });

  const total = await prisma.trip.count({ where });

  return { data: result, meta: { page, limit, total } };
};

const getTripById = async (id: string, user: User) => {
  const result = await prisma.trip.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      shipments: {
        include: {
          category: true,
          shipmentSteps: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
  }

  // Senders/Public can only see ACTIVE trips. Traveler and Admin can see their own/all.
  if (
    result.userId !== user.id &&
    user.role !== "admin" &&
    result.status !== "ACTIVE"
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  return result;
};

const updateTrip = async (id: string, data: any, user: User) => {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { shipments: true },
  });

  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
  }

  // Check ownership
  if (trip.userId !== user.id && user.role !== "admin") {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  const { status, ...detailFields } = data;
  const isUpdatingDetails = Object.keys(detailFields).length > 0;

  // Edit of trip details allowed ONLY before accepting any shipment
  if (isUpdatingDetails && trip.shipments.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot update trip details after accepting shipments",
    );
  }

  if (status && status !== trip.status) {
    if (status === "IN_TRANSIT") {
      if (trip.status === "ARRIVED") {
        const arrivedStep = await prisma.shipmentStep.findFirst({
          where: {
            shipment: { tripId: id },
            stage: "ARRIVED_AT_DESTINATION",
            completedAt: { not: null },
          },
        });
        if (arrivedStep) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Cannot revert trip status to IN_TRANSIT after shipments have arrived at destination",
          );
        }
      } else if (trip.status !== "ACTIVE") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Only active or arrived trips can be moved to in transit",
        );
      }
    } else if (status === "ARRIVED") {
      if (trip.status !== "ACTIVE" && trip.status !== "IN_TRANSIT") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Only active or in transit trips can be marked as arrived",
        );
      }
    } else if (status === "ACTIVE") {
      if (trip.status === "IN_TRANSIT" || trip.status === "ARRIVED") {
        const checkedInStep = await prisma.shipmentStep.findFirst({
          where: {
            shipment: { tripId: id },
            stage: "CHECKED_IN",
            completedAt: { not: null },
          },
        });
        if (checkedInStep) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Cannot revert trip status to ACTIVE after shipments have been checked in",
          );
        }
      }
    }
  }

  const finalFromCountry =
    data.fromCountry !== undefined ? data.fromCountry : trip.fromCountry;
  const finalToCountry =
    data.toCountry !== undefined ? data.toCountry : trip.toCountry;

  if (
    finalFromCountry &&
    finalToCountry &&
    finalFromCountry.toLowerCase() === finalToCountry.toLowerCase()
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "From country and to country cannot be the same",
    );
  }

  const updateData: any = { ...data };

  if (data.flightDate) {
    const parsedDate = new Date(data.flightDate);
    if (isNaN(parsedDate.getTime())) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid flight date format");
    }
    updateData.flightDate = parsedDate;
  }

  // Update remaining capacity if capacity is changed
  if (data.cabinBagCapacity !== undefined) {
    updateData.remainingCabinCapacity = data.cabinBagCapacity;
  }
  if (data.checkInBagCapacity !== undefined) {
    updateData.remainingCheckInCapacity = data.checkInBagCapacity;
  }

  const result = await prisma.trip.update({
    where: { id },
    data: updateData,
    include: { shipments: true },
  });

  if (
    data.cabinBagCapacity !== undefined ||
    data.checkInBagCapacity !== undefined
  ) {
    await OfferService.expireIneligibleOffersForTrip(id);
  }

  return result;
};

const cancelTrip = async (id: string, user: User) => {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      shipments: {
        include: {
          shipmentSteps: true,
          paymentTransaction: true,
        },
      },
    },
  });

  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
  }

  // Check ownership
  if (trip.userId !== user.id && user.role !== "admin") {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  if (trip.status === "CANCELLED") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Trip is already cancelled");
  }

  // Check if ANY shipment under this trip has completed the PICKED_UP step
  for (const shipment of trip.shipments) {
    const pickedUpStep = shipment.shipmentSteps.find(
      (step) => step.stage === "PICKED_UP" && step.completedAt !== null,
    );
    if (pickedUpStep) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot cancel trip directly because one or more shipments have already been picked up. Please open a support ticket.",
      );
    }
  }

  // Perform bulk cancellation inside a transaction
  return prisma.$transaction(async (tx) => {
    const updatedTrip = await tx.trip.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    for (const shipment of trip.shipments) {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.CANCELED },
      });

      await PaymentService.markPaymentAsPendingRefund(
        shipment.id,
        `Trip (${trip.flightNumber}) canceled by traveler before pickup`,
        tx,
      );

      await tx.offer.updateMany({
        where: {
          shipmentId: shipment.id,
          status: {
            in: [
              OfferStatus.ACCEPTED,
              OfferStatus.PENDING,
              OfferStatus.PAYMENT_PENDING,
            ],
          },
        },
        data: { status: OfferStatus.EXPIRED },
      });

      await NotificationService.createNotification({
        userId: shipment.userId,
        title: "Trip Canceled",
        message: `The traveler for your shipment "${shipment.itemName}" has canceled their trip. Any held payment is now pending refund.`,
      });
    }

    return updatedTrip;
  });
};

const verifyTrip = async (
  id: string,
  payload: { approved: boolean; rejectionReason?: string },
  _adminUser: User,
) => {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
  }

  const status = payload.approved ? "ACTIVE" : "REJECTED";
  const rejectionReason = payload.approved
    ? null
    : payload.rejectionReason || "Verification failed";

  const result = await prisma.trip.update({
    where: { id },
    data: {
      status,
      rejectionReason,
    },
  });

  // Create In-App Notification
  const notificationTitle = payload.approved
    ? "Trip Approved"
    : "Trip Rejected";
  const notificationMessage = payload.approved
    ? `Your flight trip from ${trip.fromCountry} to ${trip.toCountry} on ${trip.flightDate.toDateString()} has been approved and is now active.`
    : `Your flight trip from ${trip.fromCountry} to ${trip.toCountry} on ${trip.flightDate.toDateString()} was rejected. Reason: ${rejectionReason}`;

  await NotificationService.createNotification({
    userId: trip.userId,
    title: notificationTitle,
    message: notificationMessage,
  });

  // Send Email Notification
  try {
    await sendEmail({
      to: trip.user.email,
      subject: `Shiffto - ${notificationTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Shiffto Trip Update</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #0B3A8E; padding: 32px 40px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">SHIFFTO</h1>
                      <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">Travel, Ship & Earn</p>
                    </td>
                  </tr>
                  
                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 40px 40px 30px 40px;">
                      <h2 style="color: ${payload.approved ? "#10b981" : "#ef4444"}; margin: 0 0 20px 0; font-size: 22px; font-weight: 700; text-align: center;">
                        ${payload.approved ? "Trip Verification Approved 🎉" : "Trip Verification Rejected ⚠️"}
                      </h2>
                      
                      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                        Hello <strong>${trip.user.name}</strong>,
                      </p>
                      
                      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                        ${
                          payload.approved
                            ? `Great news! Your uploaded ticket and flight trip details have been reviewed and approved by our team. Your trip is now active and ready for matching with shipments.`
                            : `Thank you for submitting your trip details. Unfortunately, our team could not verify your flight trip ticket at this time.`
                        }
                      </p>

                      <!-- Trip Information Box -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #edf2f7;">
                        <tr>
                          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b; width: 140px;"><strong>Flight No:</strong></td>
                          <td style="padding-bottom: 10px; font-size: 14px; color: #1e293b; font-weight: 600;">${trip.flightNumber}</td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b;"><strong>Route:</strong></td>
                          <td style="padding-bottom: 10px; font-size: 14px; color: #1e293b; font-weight: 600;">${trip.fromCountry} &rarr; ${trip.toCountry}</td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 10px; font-size: 14px; color: #64748b;"><strong>Flight Date:</strong></td>
                          <td style="padding-bottom: 10px; font-size: 14px; color: #1e293b; font-weight: 600;">${trip.flightDate.toDateString()}</td>
                        </tr>
                        <tr>
                          <td style="font-size: 14px; color: #64748b;"><strong>Baggage Capacity:</strong></td>
                          <td style="font-size: 14px; color: #1e293b; font-weight: 600;">Cabin: ${trip.cabinBagCapacity}kg | Check-in: ${trip.checkInBagCapacity}kg</td>
                        </tr>
                      </table>

                      ${
                        !payload.approved
                          ? `
                      <!-- Rejection Reason Card -->
                      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <h4 style="color: #991b1b; margin: 0 0 6px 0; font-size: 15px; font-weight: 700;">Reason for Rejection:</h4>
                        <p style="color: #b91c1c; margin: 0; font-size: 14px; line-height: 1.5;">${rejectionReason}</p>
                      </div>
                      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                        You can correct these details and submit a new trip from your dashboard at any time.
                      </p>
                      `
                          : ""
                      }

                      <!-- CTA Button -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding: 10px 0 20px 0;">
                            <a href="${config.frontend_url}/dashboard/my-trips" target="_blank" style="background-color: #FF6F3F; color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 16px; font-weight: 700; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px rgba(255, 111, 63, 0.2); transition: background-color 0.2s;">
                              Go to Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0 0 8px 0;">
                        You received this email because your account is registered on Shiffto.
                      </p>
                      <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                        &copy; 2026 Shiffto. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }

  notifyAdminCountsUpdated();
  return result;
};

const acceptShipment = async (
  id: string,
  payload: { shipmentId: string; bagType?: "cabin" | "checkIn" },
  user: User,
) => {
  // Use transaction to ensure safe weight deduction
  return await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({
      where: { id },
      include: { shipments: true },
    });

    if (!trip) {
      throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
    }

    if (trip.userId !== user.id) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Only the traveler who created the trip can accept shipments",
      );
    }

    if (trip.status !== "ACTIVE") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Can only accept shipments for active trips",
      );
    }

    const shipment = await tx.shipment.findUnique({
      where: { id: payload.shipmentId },
    });

    if (!shipment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
    }

    if (shipment.tripId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Shipment is already assigned to a trip",
      );
    }

    // Determine bagType (default to check-in, otherwise cabin)
    const bagType = payload.bagType || "checkIn";
    const weight = shipment.weight;

    if (bagType === "checkIn") {
      if (trip.remainingCheckInCapacity < weight) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Insufficient check-in bag capacity. Needed: ${weight}kg, Available: ${trip.remainingCheckInCapacity}kg`,
        );
      }

      // Deduct capacity
      await tx.trip.update({
        where: { id },
        data: {
          remainingCheckInCapacity: { decrement: weight },
        },
      });
    } else if (bagType === "cabin") {
      if (trip.remainingCabinCapacity < weight) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Insufficient cabin bag capacity. Needed: ${weight}kg, Available: ${trip.remainingCabinCapacity}kg`,
        );
      }

      // Deduct capacity
      await tx.trip.update({
        where: { id },
        data: {
          remainingCabinCapacity: { decrement: weight },
        },
      });
    } else {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid bagType. Must be 'cabin' or 'checkIn'",
      );
    }

    // Link shipment to trip and record bagType
    const updatedShipment = await tx.shipment.update({
      where: { id: payload.shipmentId },
      data: {
        tripId: id,
        bagType,
      },
    });

    await OfferService.expireIneligibleOffersForTrip(id, tx);

    return updatedShipment;
  });
};

const completeTrip = async (id: string, user: User) => {
  const trip = await prisma.trip.findUnique({
    where: { id },
  });

  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, "Trip not found");
  }

  if (trip.userId !== user.id && user.role !== "admin") {
    throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
  }

  const result = await prisma.trip.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  return result;
};

const buildAvailableShipmentsWhere = async (user: User) => {
  const activeTrips = await prisma.trip.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
    },
    select: {
      fromCountry: true,
      toCountry: true,
      remainingCabinCapacity: true,
      remainingCheckInCapacity: true,
    },
  });

  if (activeTrips.length === 0) return null;

  const routeMap: Record<
    string,
    { fromCountry: string; toCountry: string; maxSlotCapacity: number }
  > = {};

  for (const trip of activeTrips) {
    const key = `${trip.fromCountry.toUpperCase()}_${trip.toCountry.toUpperCase()}`;
    const tripMaxSlot = Math.max(
      trip.remainingCabinCapacity,
      trip.remainingCheckInCapacity,
    );
    if (!routeMap[key]) {
      routeMap[key] = {
        fromCountry: trip.fromCountry,
        toCountry: trip.toCountry,
        maxSlotCapacity: tripMaxSlot,
      };
    } else {
      routeMap[key].maxSlotCapacity = Math.max(
        routeMap[key].maxSlotCapacity,
        tripMaxSlot,
      );
    }
  }

  const validRoutes = Object.values(routeMap).filter(
    (r) => r.maxSlotCapacity > 0,
  );
  if (validRoutes.length === 0) return null;

  const routeFilters = validRoutes.map((route) => ({
    fromCountry: { equals: route.fromCountry, mode: "insensitive" as const },
    toCountry: { equals: route.toCountry, mode: "insensitive" as const },
    weight: { lte: route.maxSlotCapacity },
  }));

  return {
    tripId: null,
    status: ShipmentStatus.AWAITING_MATCH,
    userId: { not: user.id },
    OR: routeFilters,
  };
};

const getAvailableShipments = async (
  query: Record<string, unknown>,
  user: User,
) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);

  const where = await buildAvailableShipmentsWhere(user);
  if (!where) {
    return {
      meta: {
        page,
        limit,
        total: 0,
      },
      data: [],
    };
  }

  const data = await prisma.shipment.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "asc" },
    include: {
      category: true,
      offers: {
        where: {
          travellerId: user.id,
        },
      },
    },
  });

  const total = await prisma.shipment.count({ where });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data,
  };
};

const getAvailableShipmentsCount = async (user: User) => {
  const where = await buildAvailableShipmentsWhere(user);
  if (!where) {
    return { count: 0 };
  }

  const count = await prisma.shipment.count({ where });

  return { count };
};

export const TripService = {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  cancelTrip,
  verifyTrip,
  acceptShipment,
  completeTrip,
  getAvailableShipments,
  getAvailableShipmentsCount,
};
