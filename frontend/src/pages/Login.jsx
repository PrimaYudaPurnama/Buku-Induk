import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/useAuthStore";

const Login = () => {
  const setUser = useAuthStore((state) => state.setUser);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {

      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
      
      const fetchMe = async () => {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
        });
      
        if (res.ok) {
          const data = await res.json();
          useAuthStore.getState().setUser(data.user);
        } else {
          useAuthStore.getState().logout();
        }
      };

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      await fetchMe();

      toast.success("Login successful");

      setTimeout(() => {
        navigate("/dashboard");
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const floatingVariants = {
    animate: {
      y: [0, -20, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <motion.div
        className="w-full max-w-md relative z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Card */}
        <motion.div
          className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-blue-900/50"
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {/* Header */}
          <motion.div className="text-center mb-8" variants={itemVariants}>
            <motion.div
              className="w-20 h-20  rounded-2xl flex items-center justify-center mx-auto mb-4 relative overflow-hidden"
              variants={floatingVariants}
              animate="animate"
            >
              {/* <Lock className="w-10 h-10 text-white relative z-10" /> */}
              <img src="https://res.cloudinary.com/dtbqhmgjz/image/upload/v1764926597/employees/dev/documents/e8d94016-d909-48b7-add0-3e6a745eb67a-1764926594722-Logo%20Resolusi.png" alt="" />
              
              <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-20"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </motion.div>
            <motion.h1 
              className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              Welcome Back
            </motion.h1>
            <motion.p 
              className="text-slate-400 mt-2 flex items-center justify-center gap-1"
              variants={itemVariants}
            >
              <Sparkles className="w-4 h-4" />
              Sign in to continue
            </motion.p>
          </motion.div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-xl flex items-start gap-3 backdrop-blur-sm"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300 font-medium">Login Failed</p>
                <p className="text-sm text-red-400 mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* Email Field */}
            <motion.div variants={itemVariants}>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <motion.div 
                className="relative"
                whileFocus={{ scale: 1.02 }}
              >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  className="block w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                  placeholder="you@example.com"
                />
              </motion.div>
            </motion.div>

            {/* Password Field */}
            <motion.div variants={itemVariants}>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <motion.div 
                className="relative"
                whileFocus={{ scale: 1.02 }}
              >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  className="block w-full pl-12 pr-12 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                  placeholder="••••••••"
                />
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400 hover:text-blue-400 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400 hover:text-blue-400 transition-colors" />
                  )}
                </motion.button>
              </motion.div>
            </motion.div>

            {/* Remember & Forgot */}
            {/* <motion.div 
              className="flex items-center justify-between"
              variants={itemVariants}
            >
              <div className="flex items-center">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-600 rounded bg-slate-800"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-slate-400">
                  Remember me
                </label>
              </div>
              <motion.button
                type="button"
                className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                whileHover={{ x: 5 }}
              >
                Forgot password?
              </motion.button>
            </motion.div> */}

            {/* Submit Button */}
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
              variants={itemVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
              {loading ? (
                <span className="flex items-center justify-center">
                  <motion.svg 
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </motion.svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2 relative z-10">
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </motion.button>
          </div>

          {/* Footer */}
          <motion.div 
            className="mt-8 text-center"
            variants={itemVariants}
          >
            <p className="text-sm text-slate-400">
              Don't have an account?{' '}
              <motion.button 
                type="button"
                onClick={() => window.location.href = '/register'}
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Daftar di sini
              </motion.button>
            </p>
          </motion.div>
        </motion.div>

        {/* Decorative Element */}
        <motion.div
          className="mt-6 text-center text-slate-500 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            Secured with enterprise-grade encryption
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;