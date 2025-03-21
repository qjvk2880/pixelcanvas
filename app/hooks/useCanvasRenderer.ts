'use client';

import { useCallback, useEffect, RefObject, useRef } from 'react';
import { Pixel, AnimatedPixel, Position, ViewportState } from '../types/pixel';

interface UseCanvasRendererProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  pixels: Pixel[];
  pixelMap: Map<string, string>;
  animatedPixels: AnimatedPixel[];
  width: number;
  height: number;
  scale: number;
  position: Position;
  viewport: ViewportState;
  selectedColor: string;
  hoverCoord: { x: number, y: number } | null;
}

export function useCanvasRenderer({
  canvasRef,
  containerRef,
  pixels,
  pixelMap,
  animatedPixels,
  width,
  height,
  scale,
  position,
  viewport,
  selectedColor,
  hoverCoord
}: UseCanvasRendererProps) {
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastDrawTimeRef = useRef<number>(0);

  // 캔버스 그리기 함수
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const currentTime = Date.now();
    const hasActiveAnimations = animatedPixels.some(
      animPixel => currentTime - animPixel.timestamp < 1000
    );

    // 애니메이션이 없고 마지막 그리기가 100ms 이내라면 스킵
    if (!hasActiveAnimations && currentTime - lastDrawTimeRef.current < 100) {
      return;
    }
    
    lastDrawTimeRef.current = currentTime;
    
    // 캔버스 크기 설정 및 초기화
    const rect = containerRef.current?.getBoundingClientRect() || canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    
    // 고해상도 디스플레이 지원
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    
    // 컨텍스트 스케일 설정
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    // 배경 그리기
    ctx.fillStyle = '#F8F8F8';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    
    // 픽셀 크기 계산
    const basePixelSize = Math.min(cssWidth / width, cssHeight / height) * 0.9;
    const pixelSize = basePixelSize * scale;
    
    // 중앙점 및 오프셋 계산
    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2;
    const offsetX = centerX + position.x * scale;
    const offsetY = centerY + position.y * scale;
    
    const { startX, startY, endX, endY } = viewport;
    
    // 격자 그리기 (확대 수준이 높을 때만)
    if (scale > 2) {
      ctx.strokeStyle = '#EEEEEE';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      
      for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
          const screenX = offsetX + x * pixelSize;
          const screenY = offsetY + y * pixelSize;
          ctx.rect(screenX, screenY, pixelSize, pixelSize);
        }
      }
      ctx.stroke();
    }
    
    // 색칠된 픽셀 그리기
    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        const key = `${x},${y}`;
        const color = pixelMap.get(key);
        
        if (color) {
          const screenX = offsetX + x * pixelSize;
          const screenY = offsetY + y * pixelSize;
          
          ctx.fillStyle = color;
          ctx.fillRect(screenX, screenY, pixelSize, pixelSize);
        }
      }
    }
    
    // 애니메이션 효과 그리기
    if (hasActiveAnimations) {
      animatedPixels.forEach(animPixel => {
        const elapsedTime = currentTime - animPixel.timestamp;
        if (elapsedTime >= 1000) return;

        const x = animPixel.x;
        const y = animPixel.y;
        
        if (x < startX || x >= endX || y < startY || y >= endY) return;
        
        const screenX = offsetX + x * pixelSize;
        const screenY = offsetY + y * pixelSize;
        const progress = elapsedTime / 1000;
        const waveSize = (1 - progress) * pixelSize * 1.5;
        
        ctx.globalAlpha = 0.3 * (1 - progress);
        ctx.beginPath();
        ctx.arc(
          screenX + pixelSize / 2, 
          screenY + pixelSize / 2, 
          waveSize, 
          0, 
          Math.PI * 2
        );
        ctx.fillStyle = animPixel.color;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        
        // 닉네임 표시
        if (animPixel.nickname && scale > 1) {
          const textSize = Math.max(10, pixelSize * 0.5);
          ctx.font = `${textSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = 'black';
          
          // 텍스트 배경
          const nickname = animPixel.nickname;
          const textWidth = ctx.measureText(nickname).width;
          const padding = 4;
          
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(
            screenX + pixelSize / 2 - textWidth / 2 - padding,
            screenY - padding * 2,
            textWidth + padding * 2,
            textSize + padding
          );
          
          // 텍스트 그리기
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#000000';
          ctx.fillText(
            nickname,
            screenX + pixelSize / 2,
            screenY
          );
        }
      });

      // 애니메이션이 있을 때만 다음 프레임 요청
      animationFrameRef.current = requestAnimationFrame(drawCanvas);
    }
    
    // 호버 효과
    if (hoverCoord && scale > 0.3) {
      const { x, y } = hoverCoord;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const key = `${x},${y}`;
        if (!pixelMap.has(key)) {
          const screenX = offsetX + x * pixelSize;
          const screenY = offsetY + y * pixelSize;
          
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = selectedColor;
          ctx.fillRect(screenX, screenY, pixelSize, pixelSize);
          ctx.globalAlpha = 1.0;
        }
      }
    }
  }, [
    canvasRef, 
    containerRef, 
    pixels, 
    pixelMap, 
    animatedPixels, 
    width, 
    height, 
    scale, 
    position, 
    viewport, 
    selectedColor, 
    hoverCoord
  ]);
  
  // 그리기 함수 실행
  useEffect(() => {
    drawCanvas();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawCanvas]);
  
  // 창 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      drawCanvas();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [drawCanvas]);
  
  return {
    drawCanvas
  };
} 