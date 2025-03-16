'use client';

import { useState, useEffect } from 'react';

interface NicknameModalProps {
  onSubmit: (nickname: string) => void;
  savedNickname?: string;
}

const NicknameModal: React.FC<NicknameModalProps> = ({ onSubmit, savedNickname }) => {
  const [nickname, setNickname] = useState<string>(savedNickname || '');
  const [error, setError] = useState<string>('');
  const [show, setShow] = useState<boolean>(true);

  // 저장된 닉네임이 있으면 모달 닫기
  useEffect(() => {
    console.log('NicknameModal 마운트됨, savedNickname:', savedNickname);
    if (typeof window !== 'undefined') {
      console.log('localStorage에 저장된 닉네임:', localStorage.getItem('pixel-art-nickname'));
    }
    
    if (savedNickname) {
      setShow(false);
    }
  }, [savedNickname]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    
    if (nickname.length < 2) {
      setError('닉네임은 최소 2글자 이상이어야 합니다.');
      return;
    }
    
    if (nickname.length > 15) {
      setError('닉네임은 15글자를 초과할 수 없습니다.');
      return;
    }
    
    // 로컬 스토리지에 저장
    localStorage.setItem('pixel-art-nickname', nickname);
    
    // 부모 컴포넌트로 닉네임 전달
    onSubmit(nickname);
    setShow(false);
  };

  if (!show) return null;

  // 로컬 스토리지 초기화 함수
  const resetLocalStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pixel-art-nickname');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[9999]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-80 transition-opacity duration-300 ease-in-out">
        <h2 className="text-xl font-bold mb-4 text-center">환영합니다!</h2>
        <p className="text-gray-600 mb-4 text-center">
          다른 사용자들에게 보여질 닉네임을 입력해주세요.
        </p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError('');
            }}
            placeholder="닉네임 입력 (2-15자)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={15}
            autoFocus
          />
          
          {error && (
            <p className="text-red-500 text-sm mb-3">{error}</p>
          )}
          
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors mb-2"
          >
            시작하기
          </button>
          
          {/* 디버깅용 초기화 버튼 */}
          <button
            type="button"
            onClick={resetLocalStorage}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            초기화하기 (디버깅용)
          </button>
        </form>
      </div>
    </div>
  );
};

export default NicknameModal; 