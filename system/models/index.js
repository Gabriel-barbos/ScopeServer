
import getClientModel from "./Client.js";
import getProductModel from "./Product.js";
import getScheduleModel from "./Schedule.js";
import getServiceModel from "./Service.js";
import getUserModel from "./User.js";

let modelsInitialized = false;

export const initializeModels = async () => {
  if (modelsInitialized) return;

  // IMPORTANTE: Aguardar a criação de TODOS os models
  // Dependências primeiro (Client e Product), depois os que referenciam
  await getClientModel();
  await getProductModel();
  await getUserModel();
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