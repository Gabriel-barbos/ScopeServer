  import mongoose from "mongoose";

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
  export default mongoose.model("Schedule", ScheduleSchema);
