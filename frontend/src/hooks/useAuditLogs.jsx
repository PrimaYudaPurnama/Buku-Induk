import { useState, useEffect } from "react";
import { fetchAuditLogs, fetchAuditLogById, fetchResourceAuditLogs } from "../utils/api";

export const useAuditLogs = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchAuditLogs(filters);
      setData(result.data || []);
      setPagination(result.meta?.pagination || {});
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    filters.page,
    filters.user_id,
    filters.action,
    filters.resource_type,
    filters.start_date,
    filters.end_date,
  ]);

  return { data, loading, error, pagination, refetch: loadData };
};

export const useAuditLog = (logId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!logId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchAuditLogById(logId);
        setData(result.data || null);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [logId]);

  return { data, loading, error };
};

export const useResourceAuditLogs = (resourceType, resourceId, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    if (!resourceType || !resourceId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchResourceAuditLogs(resourceType, resourceId, options);
        setData(result.data || []);
        setPagination(result.meta?.pagination || {});
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [resourceType, resourceId, options.limit, options.offset]);

  return { data, loading, error, pagination };
};

