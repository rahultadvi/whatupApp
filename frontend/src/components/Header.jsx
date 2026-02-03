import React from 'react'
import { FiCheckCircle, FiShoppingBag } from 'react-icons/fi'

function Header({ fetchOrders }) {
  return (
    <div>
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
    </div>
  )
}

export default Header
