'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, ViewportState } from '../types/pixel';

interface UseCanvasControlsProps {
  width: number;
  height: number;
  initialScale?: number;
  onViewportChange?: (viewport: ViewportState) => void;
}

interface UseCanvasControlsReturn {
  scale: number;
  position: Position;
  isDragging: boolean;
  viewport: ViewportState;
  setScale: (scale: number) => void;
  setPosition: (position: Position) => void;
  startDragging: (x: number, y: number) => void;
  stopDragging: () => void;
  handleDrag: (x: number, y: number) => void;
  handleZoom: (delta: number, clientX: number, clientY: number, containerRect: DOMRect) => void;
  moveToPosition: (targetPosition: Position) => void;
  calculatePixelSize: (containerWidth: number, containerHeight: number) => number;
  getGridCoordinates: (clientX: number, clientY: number, containerRect: DOMRect) => { x: number; y: number };
}

export function useCanvasControls({
  width,
  height,
  initialScale = 15,
  onViewportChange
}: UseCanvasControlsProps): UseCanvasControlsReturn {
  const [scale, setScale] = useState<number>(initialScale);
  const [position, setPosition] = useState<Position>({ x: -(width / 2), y: -(height / 2) });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lastMousePos, setLastMousePos] = useState<Position>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState<ViewportState>({ startX: 0, startY: 0, endX: 0, endY: 0 });
  
  const animationRef = useRef<number | null>(null);
  
  // 뷰포트 업데이트 함수
  const updateViewport = useCallback((containerRect: DOMRect | undefined) => {
    if (!containerRect) return;
    
    const basePixelSize = Math.min(containerRect.width / width, containerRect.height / height) * 0.9;
    const pixelSize = basePixelSize * scale;
    
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const offsetX = centerX + position.x * scale;
    const offsetY = centerY + position.y * scale;
    
    const startX = Math.floor((0 - offsetX) / pixelSize);
    const startY = Math.floor((0 - offsetY) / pixelSize);
    const endX = Math.ceil((containerRect.width - offsetX) / pixelSize);
    const endY = Math.ceil((containerRect.height - offsetY) / pixelSize);
    
    const newViewport = {
      startX: Math.max(0, startX),
      startY: Math.max(0, startY),
      endX: Math.min(width, endX),
      endY: Math.min(height, endY)
    };
    
    setViewport(newViewport);
    
    if (onViewportChange) {
      onViewportChange(newViewport);
    }
  }, [width, height, scale, position, onViewportChange]);
  
  // 픽셀 크기 계산 함수
  const calculatePixelSize = useCallback((containerWidth: number, containerHeight: number) => {
    const basePixelSize = Math.min(containerWidth / width, containerHeight / height) * 0.9;
    return basePixelSize * scale;
  }, [width, height, scale]);
  
  // 그리드 좌표 계산 함수
  const getGridCoordinates = useCallback((clientX: number, clientY: number, containerRect: DOMRect) => {
    const canvasX = clientX - containerRect.left;
    const canvasY = clientY - containerRect.top;
    
    const pixelSize = calculatePixelSize(containerRect.width, containerRect.height);
    
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const offsetX = centerX + position.x * scale;
    const offsetY = centerY + position.y * scale;
    
    const gridX = Math.floor((canvasX - offsetX) / pixelSize);
    const gridY = Math.floor((canvasY - offsetY) / pixelSize);
    
    return { x: gridX, y: gridY };
  }, [calculatePixelSize, position, scale]);
  
  // 드래그 시작
  const startDragging = useCallback((x: number, y: number) => {
    setIsDragging(true);
    setLastMousePos({ x, y });
  }, []);
  
  // 드래그 종료
  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // 드래그 처리
  const handleDrag = useCallback((x: number, y: number) => {
    if (!isDragging) return;
    
    const dx = x - lastMousePos.x;
    const dy = y - lastMousePos.y;
    
    setPosition(prev => ({
      x: prev.x + dx / scale,
      y: prev.y + dy / scale
    }));
    
    setLastMousePos({ x, y });
  }, [isDragging, lastMousePos, scale]);
  
  // 위치나 스케일이 변경될 때 뷰포트 업데이트
  useEffect(() => {
    // containerRect를 즉시 얻을 수 없으므로 requestAnimationFrame을 사용
    requestAnimationFrame(() => {
      // DOM이 업데이트된 후 containerRect 측정
      if (document.body) {
        const containerRect = {
          width: window.innerWidth,
          height: window.innerHeight,
          left: 0,
          top: 0,
          right: window.innerWidth,
          bottom: window.innerHeight
        } as DOMRect;
        
        updateViewport(containerRect);
      }
    });
  }, [scale, position, updateViewport]);
  
  // 줌 처리
  const handleZoom = useCallback((delta: number, clientX: number, clientY: number, containerRect: DOMRect) => {
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(50, scale * zoomFactor));
    
    if (scale !== newScale) {
      const mouseX = clientX - containerRect.left;
      const mouseY = clientY - containerRect.top;
      
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      
      const relX = mouseX - centerX - position.x * scale;
      const relY = mouseY - centerY - position.y * scale;
      
      setPosition({
        x: position.x - relX * (1 / scale - 1 / newScale),
        y: position.y - relY * (1 / scale - 1 / newScale)
      });
      
      setScale(newScale);
    }
  }, [scale, position]);
  
  // 특정 위치로 부드럽게 이동
  const moveToPosition = useCallback((targetPosition: Position) => {
    // 애니메이션이 이미 실행 중이면 취소
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    const startPosition = { ...position };
    const startTime = performance.now();
    const duration = 300; // 애니메이션 시간 (ms)
    
    const animatePosition = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic 이징 함수
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      if (progress < 1) {
        setPosition({
          x: startPosition.x + (targetPosition.x - startPosition.x) * easeProgress,
          y: startPosition.y + (targetPosition.y - startPosition.y) * easeProgress
        });
        animationRef.current = requestAnimationFrame(animatePosition);
      } else {
        setPosition(targetPosition);
        animationRef.current = null;
      }
    };
    
    animationRef.current = requestAnimationFrame(animatePosition);
  }, [position]);
  
  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  return {
    scale,
    position,
    isDragging,
    viewport,
    setScale,
    setPosition,
    startDragging,
    stopDragging,
    handleDrag,
    handleZoom,
    moveToPosition,
    calculatePixelSize,
    getGridCoordinates
  };
} 