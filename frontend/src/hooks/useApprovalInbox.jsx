import { useState, useEffect } from "react";
import { fetchMyPendingApprovals, approveStep, rejectStep } from "../utils/api";

export const useApprovalInbox = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchMyPendingApprovals();
      setData(result.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Polling every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const approve = async (approvalId, comments = "") => {
    try {
      const result = await approveStep(approvalId, comments);
      await loadData(); // Refresh
      return result;
    } catch (err) {
      throw err;
    }
  };

  const reject = async (approvalId, comments = "") => {
    try {
      const result = await rejectStep(approvalId, comments);
      await loadData(); // Refresh
      return result;
    } catch (err) {
      throw err;
    }
  };

  return { data, loading, error, refetch: loadData, approve, reject };
};

export const useApproveStep = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const approve = async (approvalId, comments = "") => {
    try {
      setLoading(true);
      setError(null);
      const result = await approveStep(approvalId, comments);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reject = async (approvalId, comments = "") => {
    try {
      setLoading(true);
      setError(null);
      const result = await rejectStep(approvalId, comments);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { approve, reject, loading, error };
};

