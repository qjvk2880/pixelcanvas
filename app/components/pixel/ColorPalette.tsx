'use client';

import { COLOR_PALETTE } from '../../types/pixel';

interface ColorPaletteProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ selectedColor, onColorSelect }) => {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
      {/* 현재 선택된 색상 표시 */}
      <div 
        className="w-8 h-8 rounded-full border-2 border-white shadow-md mb-1"
        style={{ backgroundColor: selectedColor }}
      />
      
      {/* 색상 팔레트 */}
      <div className="flex gap-1 p-2 bg-white bg-opacity-90 rounded-full shadow-lg z-10">
        {COLOR_PALETTE.map(color => (
          <div
            key={color}
            className={`w-7 h-7 rounded-full cursor-pointer border transition-transform hover:scale-110 ${
              selectedColor === color ? 'border-gray-800 scale-110 shadow-md' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onColorSelect(color)}
          />
        ))}
      </div>
    </div>
  );
};

export default ColorPalette; 