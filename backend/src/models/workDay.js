import mongoose from "mongoose";

const WorkDaySchema = new mongoose.Schema({
    date: {
      type: Date,
      required: true,
      unique: true,
    },
  
    is_working_day: {
      type: Boolean,
      default: true,
    },
  
    is_holiday: {
      type: Boolean,
      default: false,
    },
  
    holiday_name: {
      type: String,
      default: "",
    },
  
    // override dari default (misal HR ubah)
    is_override: {
      type: Boolean,
      default: false,
    },
  });

  export default mongoose.model("WorkDay", WorkDaySchema);