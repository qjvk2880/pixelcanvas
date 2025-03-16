'use client';

import { useState } from 'react';
import { User } from '../../types/pixel';

interface UsersListProps {
  users: User[];
  currentUserId: string;
}

const UsersList: React.FC<UsersListProps> = ({ users, currentUserId }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (users.length === 0) return null;

  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-white bg-opacity-90 shadow-lg transition-all duration-300 z-40 flex flex-col
      ${isCollapsed ? 'w-12' : 'w-64'}`}
    >
      <div className="flex justify-between items-center p-3 bg-gray-100 border-b">
        {!isCollapsed && (
          <h3 className="font-bold text-gray-700">접속자 {users.length}명</h3>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="p-1 rounded-full hover:bg-gray-200"
          aria-label={isCollapsed ? "펼치기" : "접기"}
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {users.map(user => (
          <div 
            key={user.id} 
            className={`flex items-center p-3 border-b hover:bg-gray-50 ${user.id === currentUserId ? 'bg-blue-50' : ''}`}
          >
            {!isCollapsed && (
              <>
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-3" 
                  style={{ backgroundColor: user.color || '#808080' }}
                >
                  {user.nickname.substring(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium truncate">
                    {user.nickname}
                    {user.id === currentUserId && ' (나)'}
                  </p>
                </div>
              </>
            )}
            {isCollapsed && (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mx-auto" 
                style={{ backgroundColor: user.color || '#808080' }}
                title={user.nickname}
              >
                {user.nickname.substring(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersList; 