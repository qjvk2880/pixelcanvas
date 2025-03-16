'use client';

interface ControlPanelProps {
  showControls: boolean;
  onToggleControls: () => void;
  onToggleMinimap: () => void;
  scale: number;
  showMinimap: boolean;
  hoverCoord: { x: number, y: number } | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  showControls,
  onToggleControls,
  onToggleMinimap,
  scale,
  showMinimap,
  hoverCoord
}) => {
  return (
    <>
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
    </>
  );
};

export default ControlPanel; 