// import User from "../models/user.js";

// /**
//  * Generate employee code in format EMP-0001, EMP-0002, etc.
//  * Auto increment based on existing active users
//  * @returns {Promise<string>} Employee code
//  */
// export const generateEmployeeCode = async () => {
//   // Find the highest employee_code number
//   const users = await User.find({
//     employee_code: { $exists: true, $ne: null },
//   })
//     .select("employee_code")
//     .sort({ employee_code: -1 })
//     .limit(1)
//     .lean();

//   let nextNumber = 1;

//   if (users.length > 0 && users[0].employee_code) {
//     // Extract number from employee_code (e.g., "EMP-0001" -> 1)
//     const match = users[0].employee_code.match(/\d+$/);
//     if (match) {
//       nextNumber = parseInt(match[0], 10) + 1;
//     }
//   }

//   // Format as EMP-0001, EMP-0002, etc.
//   const formattedNumber = nextNumber.toString().padStart(4, "0");
//   return `RESO-${formattedNumber}`;
// };



import User from "../models/user.js";

/**
 * Generate employee code in format RESO-0001, RESO-0002, etc.
 * Auto increment based on existing active users with valid employee_code
 * Robust terhadap data lama/tidak valid
 * @returns {Promise<string>} Employee code yang valid
 */
export const generateEmployeeCode = async () => {
  try {
    // Cari employee_code terbesar yang formatnya valid (RESO-XXXX)
    const latestUser = await User.findOne({
      employee_code: { 
        $exists: true, 
        $ne: null,
        $type: "string",           // pastikan tipe string
        $regex: /^RESO-\d{4,}$/     // minimal RESO- followed by digits (bisa lebih dari 4 digit jika sudah melebihi 9999)
      }
    })
      .select("employee_code")
      .sort({ employee_code: -1 })  // urutkan descending
      .lean();

    let nextNumber = 1;

    if (latestUser && latestUser.employee_code) {
      const match = latestUser.employee_code.match(/\d+$/);
      if (match) {
        nextNumber = parseInt(match[0], 10) + 1;
      }
      // Jika tidak match (format aneh), tetap pakai 1 (fallback aman)
    }

    // Format dengan 4 digit (0001, 0002, ..., 9999, lalu 10000 tanpa padding tetap)
    const formattedNumber = nextNumber.toString().padStart(4, "0");
    return `RESO-${formattedNumber}`;
  } catch (error) {
    // Jika ada error apapun (db down, query error, dll), tetap kembalikan kode aman
    // Biasanya ini jarang terjadi, tapi lebih baik aman
    console.error("Error generating employee code:", error);
    
    // Fallback: mulai dari RESO-0001
    return "RESO-0001";
  }
};