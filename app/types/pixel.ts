// 기본 픽셀 인터페이스
export interface Pixel {
  x: number;
  y: number;
  color: string;
  userId?: string;
}

// 애니메이션 효과를 위한 인터페이스 
export interface AnimatedPixel extends Pixel {
  timestamp: number;
}

// 픽셀 캔버스 속성 인터페이스
export interface PixelCanvasProps {
  width: number;
  height: number;
  pixelSize?: number;
}

// 뷰포트 정보 저장용 인터페이스
export interface ViewportState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// 색상 팔레트
export const COLOR_PALETTE = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#808080', '#A52A2A', '#008080', '#800000', '#008000'
];

// 픽셀 맵 타입 (해시맵 형태)
export type PixelMap = Map<string, string>;

// 위치 좌표 인터페이스
export interface Position {
  x: number;
  y: number;
} 