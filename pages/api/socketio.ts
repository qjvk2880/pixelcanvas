import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/db/connection';
import { Pixel } from '../../lib/models/Pixel';

// Socket.io 타입 정의
export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

// API 요청이 소켓을 위한 것인지 확인
export const config = {
  api: {
    bodyParser: false,
  },
};

// Socket.io 서버를 설정하지 않았다면 설정
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (res.socket.server.io) {
    console.log('Socket.io 서버가 이미 실행 중입니다.');
    res.end();
    return;
  }

  try {
    console.log('소켓 서버 초기화 중...');

    // MongoDB 연결
    await connectToDatabase();

    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
    });

    // 소켓 연결 이벤트 처리
    io.on('connection', (socket) => {
      console.log('클라이언트 연결됨:', socket.id);

      // 초기 픽셀 데이터 로드 및 전송
      loadInitialPixels(socket);

      // 픽셀 업데이트 이벤트 처리
      socket.on('updatePixel', async (pixel) => {
        try {
          const updatedPixel = await updatePixelInDb(pixel);
          console.log('픽셀 업데이트됨:', updatedPixel);

          // 모든 클라이언트에 업데이트 브로드캐스트
          io.emit('pixelUpdated', updatedPixel);
        } catch (error) {
          console.error('픽셀 업데이트 오류:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log('클라이언트 연결 해제됨:', socket.id);
      });
    });

    res.socket.server.io = io;
    console.log('Socket.io 서버가 성공적으로 시작되었습니다.');
  } catch (error) {
    console.error('Socket.io 서버 초기화 오류:', error);
  }

  res.end();
}

// 초기 픽셀 데이터 로드
const loadInitialPixels = async (socket: any) => {
  try {
    const pixels = await Pixel.find({}).lean();
    console.log(`초기 픽셀 데이터 전송 (${pixels.length}개)`);
    socket.emit('initialPixels', pixels);
  } catch (error) {
    console.error('초기 픽셀 데이터 로드 오류:', error);
    socket.emit('initialPixels', []);
  }
};

// 픽셀 업데이트 또는 생성
const updatePixelInDb = async (pixelData: { x: number; y: number; color: string }) => {
  try {
    const { x, y, color } = pixelData;
    
    const filter = { x, y };
    const update = { color, lastModified: new Date() };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    
    const updatedPixel = await Pixel.findOneAndUpdate(filter, update, options).lean();
    return updatedPixel;
  } catch (error) {
    console.error('데이터베이스 픽셀 업데이트 오류:', error);
    throw error;
  }
}; 