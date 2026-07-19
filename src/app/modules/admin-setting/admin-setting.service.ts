import prisma from "../../lib/prisma";

const getSettings = async () => {
  const settings = await prisma.systemSetting.findMany();
  const settingsMap: Record<string, string> = {};

  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  if (!settingsMap["WITHDRAWAL_COMMISSION_RATE"]) {
    settingsMap["WITHDRAWAL_COMMISSION_RATE"] = "0.30";
  }

  return settingsMap;
};

const updateCommissionRate = async (rate: number) => {
  const rateStr = rate.toString();
  return prisma.systemSetting.upsert({
    where: { key: "WITHDRAWAL_COMMISSION_RATE" },
    update: { value: rateStr },
    create: {
      key: "WITHDRAWAL_COMMISSION_RATE",
      value: rateStr,
      description: "Platform commission rate for traveler withdrawals (e.g. 0.30 for 30%)",
    },
  });
};

export const AdminSettingService = {
  getSettings,
  updateCommissionRate,
};
