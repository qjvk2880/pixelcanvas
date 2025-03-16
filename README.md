# 실시간 픽셀 아트 협업 서비스

여러 사용자가 함께 그릴 수 있는 실시간 픽셀 아트 협업 서비스입니다. Socket.io를 이용해 실시간으로 모든 사용자의 변경사항이 동기화됩니다.

## Vercel 배포 시 실시간 연동 문제

현재 Vercel 서버리스 환경에서는 Socket.io가 지속적인 연결을 유지하기 어려워 실시간 연동에 문제가 있습니다. 다음 해결책을 고려해보세요:

### 방법 1: AWS EC2 사용하기 (권장)

AWS EC2는 지속적으로 실행되는 가상 서버를 제공하므로 Socket.io의 WebSocket 연결을 안정적으로 유지할 수 있습니다:

1. EC2 인스턴스 생성 (t2.micro는 프리 티어 무료)
2. Ubuntu 서버 설치 후 Node.js, PM2, Nginx 설정
3. 애플리케이션 배포 및 실행

자세한 배포 가이드: [AWS-EC2-GUIDE.md](./AWS-EC2-GUIDE.md)

### 방법 2: Pusher 사용하기

[Pusher](https://pusher.com/)는 서버리스 환경에 최적화된 실시간 서비스입니다:

1. Pusher 계정 생성 및 앱 만들기
2. 다음 명령어로 Pusher 설치:
   ```bash
   npm install pusher pusher-js
   ```
3. Socket.io 코드를 Pusher 코드로 교체

### 방법 3: Railway 또는 Render로 배포

Railway나 Render와 같은 컨테이너 기반 호스팅 서비스를 사용하면 Socket.io를 그대로 유지할 수 있습니다.

### 방법 4: 로컬 개발 서버 사용

개발 목적이라면 로컬에서 `npm run dev`로 실행하는 것이 가장 간단합니다.

## 프로젝트 기능

- 1000x1000 픽셀 캔버스
- 실시간 다중 사용자 동시 편집
- 마우스로 화면 이동 및 확대/축소
- 컬러 팔레트로 색상 선택
- 사용자 닉네임 설정 및 활동 사용자 목록

## 기술 스택

- Next.js 15 (App Router)
- React 19
- TypeScript
- Socket.io (실시간 통신)
- MongoDB (픽셀 데이터 저장)
- Tailwind CSS (스타일링)

## 시작하기

먼저, 개발 서버를 실행하세요:

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

## 배포 방법

### MongoDB Atlas 설정

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)에 가입
2. 새 클러스터 생성
3. 데이터베이스 사용자 생성
4. IP 액세스 설정 (0.0.0.0/0 - 모든 IP 허용)
5. 연결 문자열 복사 (Connect -> Connect your application)

### Vercel 배포

1. GitHub에 프로젝트 저장소 생성 및 푸시
2. [Vercel](https://vercel.com) 계정 생성
3. Vercel에서 "New Project" 클릭 후 GitHub 저장소 선택
4. 환경 변수 설정:
   - `MONGODB_URI`: MongoDB Atlas 연결 문자열
5. "Deploy" 버튼 클릭

## 로컬 개발 환경 변수

`.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```
MONGODB_URI=mongodb://localhost:27017/pixel-art
```

또는 MongoDB Atlas를 로컬에서도 사용하려면:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<db-name>?retryWrites=true&w=majority
```

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
