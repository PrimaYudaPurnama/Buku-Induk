import { useState, useEffect } from "react";
import { fetchUserSalary, updateUserSalary, fetchSalaryReport } from "../utils/api";

export const useUserSalary = (userId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const result = await fetchUserSalary(userId);
      setData(result.data || null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const update = async (salaryData) => {
    try {
      const result = await updateUserSalary(userId, salaryData);
      await loadData();
      return result;
    } catch (err) {
      throw err;
    }
  };

  return { data, loading, error, update, refetch: loadData };
};

export const useSalaryReport = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchSalaryReport(filters);
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
  }, [filters.page, filters.division_id, filters.status, filters.search]);

  return { data, loading, error, pagination, refetch: loadData };
};

