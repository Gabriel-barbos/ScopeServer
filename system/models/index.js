
import { getSystemDB } from "../../config/databases.js";

import getClientModel from "./Client.js";
import getProductModel from "./Product.js";
import getUserModel from "./User.js";
import getScheduleModel from "./Schedule.js";
import getServiceModel from "./Service.js";

let modelsInitialized = false;

export const initializeModels = async () => {
  if (modelsInitialized) {
    console.log("⚠️ Models já inicializados, pulando...");
    return;
  }

  try {
   
    const systemDB = await getSystemDB();

    
    const Client = await getClientModel();
    const Product = await getProductModel();
    const User = await getUserModel();
    const Schedule = await getScheduleModel();
    const Service = await getServiceModel();


    

    // Verificar models registrados no systemDB
    const registeredModels = Object.keys(systemDB.models);

    const expectedModels = ['Client', 'Product', 'User', 'Schedule', 'Service'];
    const missingModels = expectedModels.filter(m => !registeredModels.includes(m));

    if (missingModels.length > 0) {

      throw new Error(`❌ Models faltando: ${missingModels.join(', ')}`);
    }

    modelsInitialized = true;

  } catch (error) {

    throw error;
  }
};

export {
  getClientModel,
  getProductModel,
  getScheduleModel,
  getServiceModel,
  getUserModel
};