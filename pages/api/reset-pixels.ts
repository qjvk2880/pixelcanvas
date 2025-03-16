import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/db/connection';
import { Pixel } from '../../lib/models/Pixel';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않는 메소드입니다.' });
  }

  // 보안을 위한 비밀키 확인 (환경 변수 설정 필요)
  const secretKey = req.body.secretKey || req.query.secretKey;
  if (secretKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ message: '인증에 실패했습니다.' });
  }

  try {
    // MongoDB 연결
    await connectToDatabase();
    
    // 픽셀 컬렉션의 모든 문서 삭제
    const result = await Pixel.deleteMany({});
    
    return res.status(200).json({ 
      message: '픽셀 데이터가 초기화되었습니다.',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('픽셀 초기화 중 오류 발생:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.', error });
  }
} 