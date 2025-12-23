const Stepper = ({ steps, currentStep, onStepClick, showRole = true }) => {
  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => {
        const isActive = index + 1 === currentStep;
        const isCompleted = index + 1 < currentStep;
        const isPending = index + 1 > currentStep;
        const stepStatus = step.status || (isCompleted ? "approved" : isActive ? "pending" : "pending");

        return (
          <div key={index} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <button
                onClick={() => onStepClick && onStepClick(index + 1)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  stepStatus === "approved" || isCompleted
                    ? "bg-green-500 text-white"
                    : stepStatus === "rejected"
                    ? "bg-red-500 text-white"
                    : isActive
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {stepStatus === "approved" || isCompleted ? "✓" : stepStatus === "rejected" ? "✗" : index + 1}
              </button>
              <div className="mt-2 text-center max-w-[120px]">
                <div
                  className={`text-sm font-medium ${
                    isActive ? "text-blue-600" : "text-gray-600"
                  }`}
                >
                  {step.title || step.workflowDescription || `Level ${step.level || index + 1}`}
                </div>
                {showRole && (step.workflowRole || step.role) && (
                  <div className="text-xs text-gray-500 mt-1 font-semibold">
                    {step.workflowRole || step.role}
                  </div>
                )}
                {step.subtitle && (
                  <div className="text-xs text-gray-500 mt-1">{step.subtitle}</div>
                )}
                {step.approverName && step.approverName !== "N/A" && (
                  <div className="text-xs text-gray-400 mt-1">{step.approverName}</div>
                )}
                {stepStatus && (
                  <div
                    className={`text-xs mt-1 font-semibold ${
                      stepStatus === "approved"
                        ? "text-green-600"
                        : stepStatus === "rejected"
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {stepStatus}
                  </div>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  stepStatus === "approved" || isCompleted ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;

