// system/models/index.js

import getClientModel from "./Client.js";
import getProductModel from "./Product.js";
import getScheduleModel from "./Schedule.js";
import getServiceModel from "./Service.js";
import getUserModel from "./User.js";

let modelsInitialized = false;

export const initializeModels = async () => {
  if (modelsInitialized) return;

  await getUserModel();
  await getClientModel();
  await getProductModel();
  await getScheduleModel();
  await getServiceModel();

  modelsInitialized = true;
  console.log("✅ Models do sistema inicializados");
};

export {
  getClientModel,
  getProductModel,
  getScheduleModel,
  getServiceModel,
  getUserModel
};