# AWS EC2에 픽셀 아트 협업 서비스 배포하기 (MongoDB Atlas 사용)

이 가이드는 AWS EC2 인스턴스에 Next.js 애플리케이션과 Socket.io를 배포하는 방법을 설명합니다. MongoDB는 Atlas 클라우드 서비스를 사용합니다.

## 1. AWS 계정 생성 및 EC2 인스턴스 시작

### 1.1 AWS 계정 생성
1. [AWS 회원가입](https://portal.aws.amazon.com/billing/signup) 페이지에서 계정을 생성합니다.
2. 결제 정보를 입력하고 계정 설정을 완료합니다.

### 1.2 EC2 인스턴스 생성
1. [AWS 관리 콘솔](https://console.aws.amazon.com/)에 로그인합니다.
2. EC2 서비스로 이동합니다.
3. "인스턴스 시작" 버튼을 클릭합니다.
4. 인스턴스 설정:
   - 이름: `pixel-art-server`
   - AMI: Ubuntu Server 22.04 LTS (프리 티어 적격)
   - 인스턴스 유형: t2.micro (프리 티어 적격)
   - 키 페어: 새 키 페어 생성 (이름: `pixel-art-key`)
   - 보안 그룹 설정: 다음 포트 허용
     - SSH (22): 내 IP
     - HTTP (80): 모든 IP
     - HTTPS (443): 모든 IP
     - 사용자 지정 TCP (3000): 개발용 (선택사항)
5. "인스턴스 시작" 버튼을 클릭합니다.

### 1.3 탄력적 IP 주소 할당 (선택사항)
1. EC2 대시보드에서 "탄력적 IP" 섹션으로 이동합니다.
2. "탄력적 IP 주소 할당" 버튼을 클릭하고 주소를 할당받습니다.
3. 새 주소를 선택하고 "작업" → "탄력적 IP 주소 연결"을 클릭합니다.
4. 인스턴스를 선택하고 연결합니다.

## 2. EC2 인스턴스에 환경 설정

### 2.1 SSH로 인스턴스에 연결
```bash
# 키 파일 권한 설정
chmod 400 pixel-art-key.pem

# SSH 연결
ssh -i "pixel-art-key.pem" ubuntu@your-instance-public-dns.compute.amazonaws.com
```

### 2.2 기본 소프트웨어 설치
```bash
# 시스템 업데이트
sudo apt update
sudo apt upgrade -y

# Node.js 설치 (최신 LTS 버전)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Git 설치
sudo apt install -y git

# PM2 설치 (Node.js 애플리케이션 관리)
sudo npm install -g pm2
```

## 3. MongoDB Atlas 연결 설정 확인

MongoDB Atlas 클러스터가 EC2 인스턴스에서 접속할 수 있도록 설정되어 있는지 확인하세요:

1. [MongoDB Atlas](https://cloud.mongodb.com/) 계정에 로그인합니다.
2. 클러스터로 이동 → "Network Access" 메뉴 선택
3. "ADD IP ADDRESS" 버튼 클릭
4. 모든 IP 주소 허용 (0.0.0.0/0) 또는 EC2 인스턴스의 탄력적 IP 주소만 허용
5. "Confirm" 버튼 클릭

## 4. 애플리케이션 배포

### 4.1 프로젝트 클론 및 설정
```bash
# 홈 디렉토리로 이동
cd ~

# 프로젝트 클론
git clone https://github.com/qjvk2880/pixelcanvas.git
cd pixelcanvas

# 의존성 설치
npm install

# 환경 변수 설정 (.env.local 파일 생성)
cat > .env.local << EOL
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<db-name>?retryWrites=true&w=majority
EOL
```

> 🔒 **중요**: `<username>`, `<password>`, `<cluster-url>`, `<db-name>`을 MongoDB Atlas의 실제 연결 정보로 교체하세요.

### 4.2 애플리케이션 빌드 및 실행
```bash
# 프로덕션 빌드
npm run build

# PM2로 애플리케이션 실행
pm2 start npm --name "pixel-art" -- start
pm2 save
pm2 startup
```

## 5. Nginx 설정 (도메인 연결)

### 5.1 Nginx 설치
```bash
sudo apt install -y nginx
```

### 5.2 Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/pixelart
```

다음 내용을 입력:
```
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # 도메인이 있는 경우 변경
                # 도메인이 없다면 이 줄을 제거하고 서버의 IP로 접속 가능

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Socket.io 경로 설정 (WebSocket 지원)
    location /api/socketio {
        proxy_pass http://localhost:3000/api/socketio;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.3 설정 활성화 및 Nginx 재시작
```bash
sudo ln -s /etc/nginx/sites-available/pixelart /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL 설정 (HTTPS 지원, 선택사항)

### 6.1 Let's Encrypt 설치
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 SSL 인증서 발급
```bash
# 도메인이 있는 경우
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 도메인이 없는 경우 이 단계 건너뛰기
```

## 7. 유지 관리

### 7.1 애플리케이션 업데이트
```bash
cd ~/pixelcanvas
git pull
npm install
npm run build
pm2 restart pixel-art
```

### 7.2 로그 모니터링
```bash
# PM2 로그 확인
pm2 logs pixel-art

# Nginx 로그 확인
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 7.3 자동 재시작 설정
```bash
# PM2 자동 재시작 설정
pm2 startup
pm2 save
```

## 8. 접속 확인

- 도메인이 있는 경우: 브라우저에서 `http://your-domain.com` 또는 SSL 설정 시 `https://your-domain.com` 접속
- 도메인이 없는 경우: 브라우저에서 `http://your-ec2-public-ip` 접속

## 9. 보안 팁

1. 정기적으로 서버 업데이트: `sudo apt update && sudo apt upgrade -y`
2. 방화벽 설정: `sudo ufw enable`, `sudo ufw allow ssh`, `sudo ufw allow http`, `sudo ufw allow https`
3. SSH 키 기반 인증만 허용하도록 설정
4. MongoDB Atlas 연결 문자열 보호
5. AWS 보안 그룹 설정 주기적 검토

## 10. 비용 관리

1. AWS 프리 티어 한도 모니터링
2. AWS 비용 알림 설정
3. MongoDB Atlas 무료 티어 제한 사항 확인
4. 사용하지 않을 때는 EC2 인스턴스 중지 고려 (데이터는 유지됨)
5. 필요 없는 리소스 정리 (미사용 EBS 볼륨, 탄력적 IP 등) 