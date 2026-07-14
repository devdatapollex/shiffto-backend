import prisma from "../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";
import { User } from "../../lib/auth";
import { sendEmail } from "../../lib/email";
import { paginationHelpers } from "../../helper/paginationHelpers";

const createTrip = async (data: any, user: User) => {
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
      ticketPhoto: data.ticketPhoto,
      userId: user.id,
      status: "PENDING",
    },
  });

  return result;
};

const getTrips = async (query: Record<string, unknown>, user: User) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(query);

  const where: any = {};

  // If requesting my-trips, filter by logged-in user ID
  if (query.type === "my-trips") {
    where.userId = user.id;
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
      shipments: true,
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

  // Edit allowed ONLY before accepting any shipment
  if (trip.shipments.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot update trip details after accepting shipments",
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

  return result;
};

const cancelTrip = async (id: string, user: User) => {
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

  // Cancel allowed ONLY before accepting any shipment
  if (trip.shipments.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot cancel trip after accepting shipments",
    );
  }

  const result = await prisma.trip.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return result;
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

  await prisma.notification.create({
    data: {
      userId: trip.userId,
      title: notificationTitle,
      message: notificationMessage,
    },
  });

  // Send Email Notification
  try {
    await sendEmail({
      to: trip.user.email,
      subject: `Shiffto - ${notificationTitle}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: ${payload.approved ? "#10b981" : "#ef4444"};">${notificationTitle}</h2>
          <p>Hello ${trip.user.name},</p>
          <p>${notificationMessage}</p>
          ${
            !payload.approved
              ? `<div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 6px; margin-top: 15px;">
                  <strong>Rejection Reason:</strong> ${rejectionReason}
                 </div>
                 <p style="margin-top: 15px;">You can resubmit a new trip from scratch in your dashboard.</p>`
              : ""
          }
          <br />
          <p>Best regards,</p>
          <p>The Shiffto Team</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }

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

export const TripService = {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  cancelTrip,
  verifyTrip,
  acceptShipment,
  completeTrip,
};
