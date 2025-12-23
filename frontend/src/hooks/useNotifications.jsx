import { useState, useEffect } from "react";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../utils/api";

export const useNotifications = (options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchNotifications(options);
      setData(result.data || []);
      setUnreadCount(result.unreadCount || 0);
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
    // Polling every 30 seconds for real-time updates
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [options.unread_only]);

  const markRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      await loadData(); // Refresh
    } catch (err) {
      throw err;
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      await loadData(); // Refresh
    } catch (err) {
      throw err;
    }
  };

  return {
    data,
    loading,
    error,
    unreadCount,
    pagination,
    refetch: loadData,
    markRead,
    markAllRead,
  };
};

