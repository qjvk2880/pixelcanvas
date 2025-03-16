# 실시간 픽셀 아트 협업 서비스 배포 가이드

이 문서는 실시간 픽셀 아트 협업 서비스를 Vercel에 배포하는 자세한 단계를 제공합니다.

## 1. MongoDB Atlas 설정

### 1.1 MongoDB Atlas 계정 생성
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)에 가입합니다.
2. 회원가입 후 로그인합니다.

### 1.2 클러스터 생성
1. "Build a Database" 버튼을 클릭합니다.
2. 무료 티어(FREE)를 선택합니다.
3. 클라우드 제공업체와 리전을 선택합니다 (지리적으로 가까운 리전 선택).
4. 클러스터 이름을 입력합니다 (예: pixel-art-cluster).
5. "Create" 버튼을 클릭합니다.

### 1.3 데이터베이스 사용자 생성
1. 왼쪽 메뉴에서 "Database Access"를 클릭합니다.
2. "Add New Database User" 버튼을 클릭합니다.
3. 사용자 이름과 비밀번호를 입력합니다 (보안이 강한 비밀번호 사용).
4. 권한은 "Read and write to any database"를 선택합니다.
5. "Add User" 버튼을 클릭합니다.

### 1.4 네트워크 액세스 설정
1. 왼쪽 메뉴에서 "Network Access"를 클릭합니다.
2. "Add IP Address" 버튼을 클릭합니다.
3. 모든 IP에서 접근 가능하도록 "0.0.0.0/0"을 입력합니다 (또는 특정 IP만 허용).
4. "Confirm" 버튼을 클릭합니다.

### 1.5 데이터베이스 연결 정보 얻기
1. 왼쪽 메뉴에서 "Database"를 클릭합니다.
2. 클러스터 옆의 "Connect" 버튼을 클릭합니다.
3. "Connect your application"을 선택합니다.
4. Driver는 "Node.js"를 선택합니다.
5. 연결 문자열을 복사합니다. 문자열은 다음과 같은 형식입니다:
   ```
   mongodb+srv://<username>:<password>@<cluster-url>/<db-name>?retryWrites=true&w=majority
   ```
6. `<username>`, `<password>`, `<db-name>`을 실제 값으로 변경합니다:
   - `<username>`: 생성한 데이터베이스 사용자 이름
   - `<password>`: 해당 사용자의 비밀번호
   - `<db-name>`: `pixel-art`로 설정

## 2. GitHub 저장소 설정

### 2.1 GitHub 저장소 생성
1. [GitHub](https://github.com)에 로그인합니다.
2. "New repository" 버튼을 클릭하여 새 저장소를 생성합니다.
3. 저장소 이름을 입력합니다 (예: pixel-art-collab).
4. 저장소를 공개(Public) 또는 비공개(Private)로 설정합니다.
5. "Create repository" 버튼을 클릭합니다.

### 2.2 프로젝트 푸시
로컬 프로젝트 디렉토리에서 다음 명령어를 실행합니다:

```bash
# 로컬 git 저장소 초기화 (이미 초기화되어 있다면 생략)
git init

# GitHub 저장소를 원격 저장소로 추가
git remote add origin https://github.com/사용자명/저장소명.git

# 모든 파일 스테이징
git add .

# 커밋 생성
git commit -m "Initial commit"

# GitHub로 푸시
git push -u origin main
```

## 3. Vercel 배포

### 3.1 Vercel 계정 생성 및 로그인
1. [Vercel](https://vercel.com)에 접속합니다.
2. GitHub 계정으로 가입하거나 로그인합니다.

### 3.2 프로젝트 가져오기
1. 대시보드에서 "New Project" 버튼을 클릭합니다.
2. "Import Git Repository" 섹션에서 GitHub 계정을 연결합니다.
3. 픽셀 아트 프로젝트 저장소를 선택합니다.

### 3.3 환경 변수 설정
1. 프로젝트 설정 화면에서 "Environment Variables" 섹션을 펼칩니다.
2. 다음 환경 변수를 추가합니다:
   - 이름: `MONGODB_URI`
   - 값: MongoDB Atlas 연결 문자열 (1.5에서 얻은 문자열)
   
3. 기타 필요한 환경 변수가 있다면 추가합니다.

### 3.4 프로젝트 배포
1. 모든 설정을 확인한 후 "Deploy" 버튼을 클릭합니다.
2. 배포가 완료될 때까지 기다립니다 (몇 분 소요될 수 있음).
3. 배포가 완료되면 배포된 URL을 확인합니다 (예: https://pixel-art-collab.vercel.app).

## 4. 배포 후 확인

1. 배포된 URL에 접속하여 애플리케이션이 정상적으로 작동하는지 확인합니다.
2. 다음 기능을 테스트합니다:
   - 픽셀 그리기
   - 실시간 업데이트
   - 사용자 닉네임 등록
   - 활성 사용자 목록 표시

## 5. 문제 해결

### 5.1 Socket.io 연결 오류
배포 후 Socket.io 연결 오류가 발생한다면:
1. 브라우저 콘솔 로그를 확인합니다.
2. Vercel 로그를 확인합니다 (Vercel 대시보드 -> 프로젝트 -> Deployments -> 최신 배포 -> Functions 탭).
3. `/api/socketio` 경로가 올바르게 설정되었는지 확인합니다.

### 5.2 MongoDB 연결 오류
MongoDB 연결 오류가 발생한다면:
1. 환경 변수 `MONGODB_URI`가 올바르게 설정되었는지 확인합니다.
2. MongoDB Atlas의 Network Access 설정에서 모든 IP(0.0.0.0/0)가 허용되어 있는지 확인합니다.
3. 데이터베이스 사용자 권한이 올바르게 설정되었는지 확인합니다.

### 5.3 기타 문제
기타 배포 관련 문제가 발생한다면 Vercel 로그를 확인하고, 필요한 경우 Vercel 지원 또는 커뮤니티 포럼에 문의하세요. 