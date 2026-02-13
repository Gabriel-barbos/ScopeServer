import getClientModel from "./Client.js";
import getProductModel from "./Product.js";
import getScheduleModel from "./Schedule.js";
import getServiceModel from "./Service.js";
import getUserModel from "./User.js";
import getServiceLegacyModel from "./ServiceLegacy.js";

let modelsInitialized = false;

export const initializeModels = async () => {
  if (modelsInitialized) return;

  await getClientModel();
  await getProductModel();
  await getUserModel();
  await getScheduleModel();
  await getServiceModel();
  await getServiceLegacyModel();

  modelsInitialized = true;
  console.log("✅ Models do sistema inicializados");
};

export {
  getClientModel,
  getProductModel,
  getScheduleModel,
  getServiceModel,
  getServiceLegacyModel,
  getUserModel,
};