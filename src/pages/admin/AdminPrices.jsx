import React from 'react';
import PriceList from '../customer/PriceList';

const AdminPrices = () => {
  return (
    <div className="animate-fade-in -m-4 sm:-m-6 lg:-m-8 overflow-hidden h-[calc(100vh-64px)]">
      {/* We reuse the customer PriceList component but wrap it nicely for admin */}
      <div className="h-full overflow-y-auto bg-gray-50">
        <PriceList />
      </div>
    </div>
  );
};

export default AdminPrices;
