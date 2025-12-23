/**
 * Pure salary masking based on resolved permission context
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
      user.division_id._id &&
      user.division_id._id.toString() === divisionId;

    let salary = null;

    if (canViewAny) {
      salary = user.salary;
    } else if (canViewOwnDivision && sameDivision) {
      salary = user.salary;
    } else if (canViewSelf && isSelf) {
      salary = user.salary;
    }

    return {
      ...user,
      salary: salary != null ? salary.toString() : null,
    };
  });
}
