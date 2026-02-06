  import mongoose from "mongoose";
  import { getSystemDB } from "../../config/databases.js";

  const ScheduleSchema = new mongoose.Schema(
    {
      plate: { type: String, required: false },
      vin: { type: String, required: true },
      model : { type: String, required: true },  
      scheduledDate: { type: Date, required: false },
      serviceType: { type: String, required: true },
      notes: { type: String },
      createdBy: { type: String },
      provider : {type: String, required: false },
      orderNumber : {type: String, required: false },
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: function () {
          return this.serviceType === "installation";
        },
      },

      client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
        required: true,
      },
  
      status: {
        type: String,
        enum: ["criado", "agendado", "concluido", "atrasado", "cancelado"],
        default: "criado",
      },



    },
    { timestamps: true }
  );
    let systemDB = null;
    let Schedule = null;

    const getScheduleModel = async () => {
      if (Schedule) return Schedule;
      
      if (!systemDB) {
        systemDB = await getSystemDB();
      }
      
      Schedule = systemDB.models.Schedule || systemDB.model("Schedule", ScheduleSchema);
      return Schedule;
    };

    export default getScheduleModel;