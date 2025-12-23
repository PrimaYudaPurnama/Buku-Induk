import { useParams } from "react-router-dom";
import { useAccountRequest } from "../hooks/useAccountRequests";
import Stepper from "../components/Stepper";
import { mapApprovalsToSteps, getWorkflowName } from "../utils/workflowUtils";

const ApprovalDetail = () => {
  const { id } = useParams();
  const { data, loading, error } = useAccountRequest(id);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Memuat detail...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error: {error || "Data tidak ditemukan"}</div>
      </div>
    );
  }

  const approvals = data.approvals || [];
  const requestType = data.request_type || "account_request";
  
  // Map approvals with workflow info
  const mappedSteps = mapApprovalsToSteps(approvals, requestType);
  
  const steps = mappedSteps.map((step) => ({
    level: step.approval_level,
    title: step.workflowDescription,
    role: step.workflowRole,
    approverName: step.approverName,
    approverEmail: step.approverEmail,
    status: step.status,
    comments: step.comments,
    processed_at: step.processed_at,
  }));

  const currentStep = approvals.findIndex((a) => a.status === "pending") + 1 || approvals.length + 1;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{getWorkflowName(requestType)}</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Informasi Permintaan</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Requester:</strong> {data.requester_name}
          </div>
          <div>
            <strong>Email:</strong> {data.email}
          </div>
          <div>
            <strong>Status:</strong> 
            <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
              data.status === "approved" ? "bg-green-100 text-green-800" :
              data.status === "rejected" ? "bg-red-100 text-red-800" :
              "bg-yellow-100 text-yellow-800"
            }`}>
              {data.status}
            </span>
          </div>
          <div>
            <strong>Request Type:</strong> {getWorkflowName(requestType)}
          </div>
        </div>
        {data.notes && (
          <div className="mt-4">
            <strong>Notes:</strong>
            <p className="mt-1">{data.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Timeline Persetujuan</h2>
        <Stepper steps={steps} currentStep={currentStep} showRole={true} />
        
        {/* Approval Details */}
        <div className="mt-6 space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                step.status === "approved"
                  ? "bg-green-50 border-green-200"
                  : step.status === "rejected"
                  ? "bg-red-50 border-red-200"
                  : step.status === "pending"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-gray-900">
                    Level {step.level}: {step.role}
                  </div>
                  <div className="text-sm text-gray-600">{step.title}</div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    step.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : step.status === "rejected"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {step.status}
                </span>
              </div>
              {step.approverName && step.approverName !== "N/A" && (
                <div className="text-sm text-gray-600">
                  <strong>Approver:</strong> {step.approverName}
                  {step.approverEmail && ` (${step.approverEmail})`}
                </div>
              )}
              {step.comments && (
                <div className="mt-2 text-sm text-gray-700">
                  <strong>Comments:</strong> {step.comments}
                </div>
              )}
              {step.processed_at && (
                <div className="mt-1 text-xs text-gray-500">
                  Processed: {new Date(step.processed_at).toLocaleString("id-ID")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApprovalDetail;
