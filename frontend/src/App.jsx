import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FiPackage,
  FiDollarSign,
  FiShoppingBag,
  FiUsers,
  FiTrendingUp,
  FiCalendar,
  FiTruck,
  FiHome,
  FiCheckCircle,
  FiClock
} from "react-icons/fi";
import { BsWhatsapp } from "react-icons/bs";

const BASE_URL = "https://whatupappnewapp.onrender.com"; 
function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    pendingOrders: 0,
    completedOrders: 0
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // grid or list

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_URL}/orders`);
      const ordersData = res.data.data;
      setOrders(ordersData);
      
      // Calculate statistics
      const totalRevenue = ordersData.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);
      const completedOrders = ordersData.filter(order => 
        order.status === 'completed' || order.purchaseMethod === 'STORE_PICKUP'
      ).length;
      
      setStats({
        totalOrders: ordersData.length,
        totalRevenue: totalRevenue,
        avgOrderValue: ordersData.length > 0 ? totalRevenue / ordersData.length : 0,
        pendingOrders: ordersData.length - completedOrders,
        completedOrders: completedOrders
      });
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (method) => {
    switch (method) {
      case 'HOME_DELIVERY':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'STORE_PICKUP':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (method) => {
    switch (method) {
      case 'HOME_DELIVERY':
        return <FiTruck className="inline mr-2" />;
      case 'STORE_PICKUP':
        return <FiHome className="inline mr-2" />;
      default:
        return <FiShoppingBag className="inline mr-2" />;
    }
  };

  const StatsCard = ({ title, value, icon, color, change }) => (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 transform transition-transform hover:scale-105 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs md:text-sm font-medium">{title}</p>
          <p className="text-xl md:text-3xl font-bold mt-1 md:mt-2">{value}</p>
          {change && (
            <div className={`hidden md:flex items-center mt-2 text-sm ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              <FiTrendingUp className={`mr-1 ${change > 0 ? '' : 'rotate-180'}`} />
              {Math.abs(change)}% from last month
            </div>
          )}
        </div>
        <div className={`p-2 md:p-3 rounded-full ${color}`}>
          <span className="text-lg md:text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );

  const OrderCard = ({ order, index }) => (
    <div 
      className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
      onClick={() => setSelectedOrder(order)}
    >
      <div className="p-4 md:p-6">
        <div className="flex justify-between items-start mb-3 md:mb-4">
          <div className="max-w-[70%]">
            <span className="text-gray-500 text-xs md:text-sm">Order #{order.orderId?.substring(0, 8) || order._id.substring(0, 8)}</span>
            <h3 className="text-base md:text-lg font-bold text-gray-900 mt-1 truncate">
              {order.customerDetails?.name || 'Customer'}
            </h3>
          </div>
          <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.purchaseMethod)}`}>
            <span className="hidden md:inline">
              {getStatusIcon(order.purchaseMethod)}
              {order.purchaseMethod === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}
            </span>
            <span className="md:hidden">
              {getStatusIcon(order.purchaseMethod)}
              {order.purchaseMethod === 'HOME_DELIVERY' ? 'Delivery' : 'Pickup'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="flex items-center text-gray-600">
            <FiCalendar className="mr-2 text-sm md:text-base" />
            <span className="text-xs md:text-sm truncate">{formatDate(order.createdAt)}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <FiDollarSign className="mr-2 text-sm md:text-base" />
            <span className="text-sm md:text-base font-bold">${order.pricing?.total || 0}</span>
          </div>
        </div>

        {/* Product Images Gallery - Mobile friendly */}
        <div className="mb-4 md:mb-6">
          <p className="text-xs md:text-sm text-gray-500 mb-2">Products Ordered:</p>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {order.selectedShoes?.slice(0, 3).map((product, idx) => (
              <div key={idx} className="flex-shrink-0 relative group">
                <img
                  src={product.imageUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop"}
                  alt={product.name}
                  className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-lg border-2 border-gray-200 group-hover:border-blue-500 transition-all duration-300"
                  onError={(e) => {
                    e.target.src = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop";
                  }}
                />
                {order.selectedShoes.length > 3 && idx === 2 && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">+{order.selectedShoes.length - 3}</span>
                  </div>
                )}
              </div>
            ))}
            {(!order.selectedShoes || order.selectedShoes.length === 0) && (
              <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FiPackage className="text-gray-400" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center overflow-hidden">
            <BsWhatsapp className="text-green-500 mr-2 flex-shrink-0" />
            <span className="text-xs md:text-sm text-gray-600 truncate">{order.phone}</span>
          </div>
          <button 
            className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300 text-xs md:text-sm font-medium whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://wa.me/${order.phone}`, '_blank');
            }}
          >
            Contact
          </button>
        </div>
      </div>
    </div>
  );

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm md:text-base">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 md:space-x-4 mb-4 md:mb-0">
              <div className="bg-white p-2 md:p-3 rounded-full shadow-lg">
                <FiShoppingBag className="text-blue-600 text-lg md:text-2xl" />
              </div>
              <div>
                <h1 className="text-xl md:text-3xl font-bold">Sarwan Shoes Dashboard</h1>
                <p className="text-blue-100 text-xs md:text-sm">Real-time order management system</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 md:space-x-4">
              <button 
                onClick={fetchOrders}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors duration-300 flex items-center text-xs md:text-sm"
              >
                <FiCheckCircle className="mr-1 md:mr-2" />
                <span className="hidden md:inline">Refresh Orders</span>
                <span className="md:hidden">Refresh</span>
              </button>
              <div className="text-right">
                <p className="text-xs md:text-sm text-blue-200">Last updated</p>
                <p className="font-semibold text-sm md:text-base">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="container mx-auto px-4 md:px-6 -mt-3 md:-mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <StatsCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={<FiShoppingBag className="text-blue-600" />}
            color="bg-blue-50"
            change={12.5}
          />
          <StatsCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toFixed(2)}`}
            icon={<FiDollarSign className="text-green-600" />}
            color="bg-green-50"
            change={8.2}
          />
          <StatsCard
            title="Avg Order"
            value={`$${stats.avgOrderValue.toFixed(2)}`}
            icon={<FiTrendingUp className="text-purple-600" />}
            color="bg-purple-50"
            change={5.7}
          />
          <StatsCard
            title="Active Orders"
            value={stats.pendingOrders}
            icon={<FiClock className="text-yellow-600" />}
            color="bg-yellow-50"
            change={-3.2}
          />
        </div>

        {/* View Toggle */}
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h2 className="text-lg md:text-2xl font-bold text-gray-800">Recent Orders</h2>
          <div className="flex space-x-1 md:space-x-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm ${viewMode === "grid" ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
            >
              <span className="hidden md:inline">Grid View</span>
              <span className="md:hidden">Grid</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm ${viewMode === "list" ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
            >
              <span className="hidden md:inline">List View</span>
              <span className="md:hidden">List</span>
            </button>
          </div>
        </div>

        {/* Orders Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            {orders.map((order, index) => (
              <OrderCard key={order._id} order={order} index={index} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="py-3 px-4 md:px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Order Details
                    </th>
                    <th className="py-3 px-4 md:px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="py-3 px-4 md:px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="py-3 px-4 md:px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="py-3 px-4 md:px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 md:px-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order, index) => (
                    <tr key={order._id} className="hover:bg-gray-50 transition-colors duration-300">
                      <td className="py-3 px-4 md:px-6">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm md:text-base">
                            #{order.orderId?.substring(0, 8) || order._id.substring(0, 8)}
                          </p>
                          <p className="text-xs md:text-sm text-gray-500 truncate max-w-[120px]">{formatDate(order.createdAt)}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div>
                          <p className="font-medium text-gray-900 text-sm md:text-base truncate max-w-[100px]">{order.customerDetails?.name}</p>
                          <div className="flex items-center mt-1">
                            <BsWhatsapp className="text-green-500 mr-1 text-xs md:text-sm" />
                            <p className="text-xs md:text-sm text-gray-600 truncate max-w-[100px]">{order.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="flex -space-x-2">
                          {order.selectedShoes?.slice(0, 3).map((product, idx) => (
                            <img
                              key={idx}
                              src={product.imageUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&auto=format&fit=crop"}
                              alt={product.name}
                              className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white object-cover"
                              onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&auto=format&fit=crop";
                              }}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <p className="font-bold text-gray-900 text-sm md:text-base">${order.pricing?.total || 0}</p>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.purchaseMethod)}`}>
                          <span className="hidden md:inline">
                            {order.purchaseMethod === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}
                          </span>
                          <span className="md:hidden">
                            {order.purchaseMethod === 'HOME_DELIVERY' ? 'Delivery' : 'Pickup'}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <button
                          onClick={() => window.open(`https://wa.me/${order.phone}`, '_blank')}
                          className="px-3 py-1.5 md:px-4 md:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-300 text-xs md:text-sm font-medium flex items-center"
                        >
                          <BsWhatsapp className="mr-1 md:mr-2" />
                          <span className="hidden md:inline">WhatsApp</span>
                          <span className="md:hidden">Msg</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start md:items-center justify-center p-2 md:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-lg md:max-w-2xl my-4 md:my-0 max-h-[90vh] overflow-y-auto">
              <div className="p-4 md:p-8">
                <div className="flex justify-between items-start mb-4 md:mb-6">
                  <div className="max-w-[80%]">
                    <h2 className="text-lg md:text-2xl font-bold text-gray-900 truncate">Order Details</h2>
                    <p className="text-gray-600 text-sm md:text-base truncate">
                      #{selectedOrder.orderId || selectedOrder._id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl md:text-2xl p-2"
                  >
                    &times;
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
                  <div className="bg-gray-50 rounded-xl p-4 md:p-6">
                    <h3 className="font-bold text-gray-900 mb-3 md:mb-4 flex items-center text-sm md:text-base">
                      <FiUsers className="mr-2" />
                      Customer Information
                    </h3>
                    <div className="space-y-2 md:space-y-3">
                      <div>
                        <p className="text-xs md:text-sm text-gray-500">Name</p>
                        <p className="font-medium text-sm md:text-base truncate">{selectedOrder.customerDetails?.name}</p>
                      </div>
                      <div>
                        <p className="text-xs md:text-sm text-gray-500">Phone</p>
                        <p className="font-medium text-sm md:text-base flex items-center">
                          <BsWhatsapp className="text-green-500 mr-2" />
                          {selectedOrder.phone}
                        </p>
                      </div>
                      {selectedOrder.customerDetails?.address && (
                        <div>
                          <p className="text-xs md:text-sm text-gray-500">Address</p>
                          <p className="font-medium text-sm md:text-base">{selectedOrder.customerDetails.address}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 md:p-6">
                    <h3 className="font-bold text-gray-900 mb-3 md:mb-4 flex items-center text-sm md:text-base">
                      <FiPackage className="mr-2" />
                      Order Summary
                    </h3>
                    <div className="space-y-2 md:space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-xs md:text-sm">Order Date</span>
                        <span className="font-medium text-xs md:text-sm text-right">{formatDate(selectedOrder.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-xs md:text-sm">Delivery Method</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedOrder.purchaseMethod)}`}>
                          <span className="hidden md:inline">
                            {selectedOrder.purchaseMethod === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}
                          </span>
                          <span className="md:hidden">
                            {selectedOrder.purchaseMethod === 'HOME_DELIVERY' ? 'Delivery' : 'Pickup'}
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-xs md:text-sm">Subtotal</span>
                        <span className="font-medium text-xs md:text-sm">${selectedOrder.pricing?.subtotal || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-xs md:text-sm">Delivery Fee</span>
                        <span className="font-medium text-xs md:text-sm">${selectedOrder.pricing?.deliveryFee || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm md:text-lg font-bold pt-2 md:pt-3 border-t">
                        <span>Total</span>
                        <span className="text-blue-600">${selectedOrder.pricing?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div className="mb-6 md:mb-8">
                  <h3 className="font-bold text-gray-900 mb-3 md:mb-4 flex items-center text-sm md:text-base">
                    <FiShoppingBag className="mr-2" />
                    Products ({selectedOrder.selectedShoes?.length || 0})
                  </h3>
                  <div className="space-y-3 md:space-y-4">
                    {selectedOrder.selectedShoes?.map((product, idx) => (
                      <div key={idx} className="flex items-center bg-gray-50 rounded-xl p-3 md:p-4">
                        <img
                          src={product.imageUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop"}
                          alt={product.name}
                          className="w-14 h-14 md:w-20 md:h-20 object-cover rounded-lg mr-3 md:mr-4 flex-shrink-0"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop";
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm md:text-base truncate">{product.name}</h4>
                          <p className="text-xs md:text-sm text-gray-600 truncate">Code: {product.code}</p>
                          <div className="flex items-center mt-1 md:mt-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-sm md:text-base mr-2">${product.price}</span>
                            <span className="text-xs md:text-sm text-gray-600">Size: {product.size}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={() => window.open(`https://wa.me/${selectedOrder.phone}`, '_blank')}
                    className="px-4 py-2 md:px-6 md:py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-300 font-medium flex items-center justify-center text-sm md:text-base"
                  >
                    <BsWhatsapp className="mr-2" />
                    Contact on WhatsApp
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 md:px-6 md:py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-300 font-medium text-sm md:text-base"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-6 md:py-8 text-gray-600 text-xs md:text-sm">
          <p>Sarwan Shoes Admin Dashboard • Real-time WhatsApp Commerce Platform</p>
          <p className="mt-1 md:mt-2">Total Orders: {stats.totalOrders} • Total Revenue: ${stats.totalRevenue.toFixed(2)} • Last Updated: {new Date().toLocaleString([], {hour: '2-digit', minute:'2-digit'})}</p>
        </footer>
        {/* <Footer /> */}
      </div>
    </div>
  );
}

export default App;