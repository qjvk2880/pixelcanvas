import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 사용하지 않는 변수 경고 끄기
      "@typescript-eslint/no-unused-vars": "off",
      // ts-ignore 사용 허용
      "@typescript-eslint/ban-ts-comment": "off",
      // any 타입 허용
      "@typescript-eslint/no-explicit-any": "off",
      // var 사용 허용
      "no-var": "off",
      // let 대신 const 사용 권장 끄기
      "prefer-const": "off",
      // React Hook 의존성 경고 끄기
      "react-hooks/exhaustive-deps": "off"
    }
  }
];

export default eslintConfig;
