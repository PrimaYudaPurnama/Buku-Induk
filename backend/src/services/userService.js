import Salary from "../models/salary.js";

/**
 * Pure salary masking based on resolved permission context
 * Now uses Salary model instead of user.salary field
 */
export function maskSalaryForUsers(users, salaryContext) {
  const {
    canViewAny = false,
    canViewOwnDivision = false,
    canViewSelf = false,
    divisionId = null,
    currentUserId = null,
  } = salaryContext;

  return users.map((user) => {
    const isSelf = currentUserId && user._id.toString() === currentUserId;
    const sameDivision =
      divisionId &&
      user.division_id?._id &&
      user.division_id._id.toString() === divisionId;

    let salaryData = null;

    if (canViewAny) {
      salaryData = user.salary_data;
    } else if (canViewOwnDivision && sameDivision) {
      salaryData = user.salary_data;
    } else if (canViewSelf && isSelf) {
      salaryData = user.salary_data;
    }

    // Return take_home_pay as salary for backward compatibility
    return {
      ...user,
      salary: salaryData?.take_home_pay ? salaryData.take_home_pay.toString() : null,
      salary_data: salaryData, // Include full salary data
    };
  });
}

/**
 * Populate salary data for users
 * @param {Array} users - Array of user documents
 * @returns {Promise<Array>} Users with populated salary data
 */
export async function populateSalaryForUsers(users) {
  if (!users || users.length === 0) return users;

  const userIds = users.map(u => u._id);
  const salaries = await Salary.find({ 
    user_id: { $in: userIds },
    // status: "active"
  }).lean();

  const salaryMap = {};
  salaries.forEach(s => {
    salaryMap[s.user_id.toString()] = {
      _id: s._id,
      base_salary: s.base_salary?.toString() || null,
      currency: s.currency,
      allowances: s.allowances?.map(a => ({
        name: a.name,
        amount: a.amount?.toString() || null,
      })) || [],
      deductions: s.deductions?.map(d => ({
        name: d.name,
        amount: d.amount?.toString() || null,
        category: d.category,
      })) || [],
      total_allowance: s.total_allowance?.toString() || null,
      total_deduction: s.total_deduction?.toString() || null,
      take_home_pay: s.take_home_pay?.toString() || null,
      status: s.status,
      bank_account: s.bank_account,
      note: s.note,
    };
  });

  return users.map(user => ({
    ...user,
    salary_data: salaryMap[user._id.toString()] || null,
    salary: salaryMap[user._id.toString()]?.take_home_pay || null, // Backward compatibility
  }));
}
