import { useState, useEffect } from "react";
import { fetchAccountRequests, createAccountRequest, fetchAccountRequestById } from "../utils/api";

export const useAccountRequests = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchAccountRequests(filters);
      setData(result.data || []);
      setPagination(result.pagination || {});
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.page, filters.status, filters.request_type]);

  const create = async (requestData) => {
    try {
      const result = await createAccountRequest(requestData);
      await loadData(); // Refresh list
      return result;
    } catch (err) {
      throw err;
    }
  };

  return { data, loading, error, pagination, refetch: loadData, create };
};

export const useCreateAccountRequest = () => {
  const create = async (requestData) => {
    return await createAccountRequest(requestData);
  };

  return { create };
};


export const useAccountRequest = (requestId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!requestId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchAccountRequestById(requestId);
        setData(result.data || null);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [requestId]);

  return { data, loading, error };
};

