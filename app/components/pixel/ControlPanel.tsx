'use client';

import React, { useState } from 'react';

interface ControlPanelProps {
  showControls: boolean;
  onToggleControls: () => void;
  onToggleMinimap: () => void;
  scale: number;
  showMinimap: boolean;
  hoverCoord: { x: number, y: number } | null;
  isAdmin?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  showControls,
  onToggleControls,
  onToggleMinimap,
  scale,
  showMinimap,
  hoverCoord,
  isAdmin = false
}) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [secretKey, setSecretKey] = useState<string>('');
  const [resetStatus, setResetStatus] = useState<string>('');
  
  const handleResetPixels = async () => {
    try {
      setResetStatus('초기화 중...');
      const response = await fetch('/api/reset-pixels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secretKey }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResetStatus(`성공: ${data.deletedCount}개 픽셀 초기화됨`);
        setTimeout(() => {
          setIsResetModalOpen(false);
          setResetStatus('');
          setSecretKey('');
          // 페이지 새로고침 (선택사항)
          window.location.reload();
        }, 2000);
      } else {
        setResetStatus(`오류: ${data.message}`);
      }
    } catch (error) {
      setResetStatus('서버 오류가 발생했습니다.');
      console.error('픽셀 초기화 중 오류:', error);
    }
  };

  return (
    <div className="fixed right-4 top-4 z-10 space-y-2">
      {/* 도움말 토글 버튼 */}
      <div 
        className="fixed top-4 right-4 w-8 h-8 bg-white bg-opacity-70 rounded-full flex items-center justify-center cursor-pointer shadow-md"
        onClick={onToggleControls}
      >
        <span className="text-gray-600 text-sm font-bold">?</span>
      </div>
      
      {/* 사용법 안내 (토글 가능) */}
      {showControls && (
        <div className="fixed top-14 right-4 bg-white bg-opacity-80 p-2 rounded-lg shadow-md text-xs z-10 max-w-[200px]">
          <p>마우스 휠: 확대/축소</p>
          <p>좌클릭: 픽셀 색칠</p>
          <p>우클릭 + 드래그: 화면 이동</p>
          <p>H: 도움말 표시/숨김</p>
          <p>M: 미니맵 표시/숨김</p>
          <p className="mt-1 text-gray-500">배율: {Math.round(scale * 100)}%</p>
        </div>
      )}
      
      {/* 좌표 표시기 */}
      {showControls && hoverCoord && (
        <div className="fixed bottom-16 left-4 bg-white bg-opacity-70 py-1 px-2 rounded-lg text-xs">
          {hoverCoord.x}, {hoverCoord.y}
        </div>
      )}
      
      {/* 디버깅용 표시 */}
      <div className="fixed top-4 left-4 bg-white bg-opacity-70 py-1 px-2 rounded-lg text-xs">
        배율: {Math.round(scale * 100)}% | 미니맵: {showMinimap ? '표시' : '숨김'}
      </div>
      
      {/* 관리자 메뉴 (개발 환경에서만 표시되거나 관리자 권한이 있을 경우에만 표시) */}
      {(process.env.NODE_ENV === 'development' || isAdmin) && (
        <div className="flex flex-col space-y-2 mt-4">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
            title="픽셀 데이터 초기화 (관리자 전용)"
          >
            데이터 초기화
          </button>
        </div>
      )}
      
      {/* 초기화 확인 모달 */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">픽셀 데이터 초기화</h2>
            <p className="mb-4 text-red-600">경고: 이 작업은 모든 픽셀 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">관리자 키</label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="관리자 키를 입력하세요"
              />
            </div>
            
            {resetStatus && (
              <div className={`mb-4 p-2 rounded ${resetStatus.includes('성공') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {resetStatus}
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
              >
                취소
              </button>
              <button
                onClick={handleResetPixels}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                disabled={!secretKey || resetStatus.includes('중')}
              >
                초기화 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel; 