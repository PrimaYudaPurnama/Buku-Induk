import { useState, useEffect } from "react";
import { fetchRoles, fetchRoleById, createRole, updateRole, deleteRole } from "../utils/api";

export const useRoles = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchRoles(filters);
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
  }, [filters.search]);

  const create = async (roleData) => {
    try {
      const result = await createRole(roleData);
      await loadData();
      return result;
    } catch (err) {
      throw err;
    }
  };

  const update = async (roleId, roleData) => {
    try {
      const result = await updateRole(roleId, roleData);
      await loadData();
      return result;
    } catch (err) {
      throw err;
    }
  };

  const remove = async (roleId) => {
    try {
      const result = await deleteRole(roleId);
      await loadData();
      return result;
    } catch (err) {
      throw err;
    }
  };

  return { data, loading, error, refetch: loadData, create, update, delete: remove };
};

export const useRole = (roleId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roleId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchRoleById(roleId);
        setData(result.data || null);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roleId]);

  return { data, loading, error };
};

