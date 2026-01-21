export type Locale = 'ko' | 'ja';

export const translations = {
    ko: {
        header: {
            about: "Clinic.ai 란?",
            why: "WHY AIO·GEO",
            success: "성공사례",
            solution: "솔루션소개",
            cta: "상담 문의하기"
        },
        input: {
            url_label: "홈페이지 URL",
            hospital_name_label: "병원명",
            address_label: "주소",
            keywords_label: "진료 세부키워드/주요서비스",
            keywords_placeholder: "예: 임플란트, 치아교정 (쉼표로 구분)",
            location_keywords_label: "주요 위치 키워드 (선택)",
            branding_label: "병원 한 줄 소개 (선택)",
            start_btn: "진단 시작",
            error_required: "필수 항목을 입력해주세요.",
            error_url: "유효한 URL을 입력해주세요."
        },
        loading: {
            main: "Clinic.ai가 입력하신 정보를 바탕으로 상세히 분석 중입니다.",
            sub: "잠시만 기다려 주세요.",
            notice: "입력한 URL을 포함한 최대 10개 페이지를 분석합니다.",
            step1: "페이지 수집 중",
            step2: "구조/메타 분석 중",
            step3: "신뢰/FAQ 분석 중",
            step4: "리포트 생성 중"
        },
        result: {
            top_notice: "입력한 URL을 포함한 최대 10개 페이지를 AI가 분석하여 도출한 결과입니다.",
            analyzed_pages: "분석 페이지 수",
            cta_title: "Clinic.ai를 통해 AI검색을 빠르게 선점하세요.",
            cta_btn: "상담 문의하기",
            categories: {
                relevance: "진료과목 정합성",
                structure: "콘텐츠 구조화",
                indexing: "메타/인덱싱 위생",
                trust: "신뢰 신호(의료 정보)",
                faq_schema: "FAQ·스키마 준비도"
            },
            check_labels: {
                title_keyword: "Title에 진료과목 포함",
                h1_match: "H1 일치",
                faq_count: "FAQ 5문항 이상"
                // ... add dynamic ones or map by key later
            }
        }
    },
    ja: {
        header: {
            about: "Clinic.aiとは?",
            why: "WHY AIO·GEO",
            success: "成功事例",
            solution: "ソリューション紹介",
            cta: "相談・お問い合わせ"
        },
        input: {
            url_label: "ホームページURL",
            hospital_name_label: "病院名",
            address_label: "住所",
            keywords_label: "診療キーワード/主なサービス",
            keywords_placeholder: "例: インプラント, 矯正歯科 (カンマ区切り)",
            location_keywords_label: "主な場所キーワード (任意)",
            branding_label: "病院の一言紹介 (任意)",
            start_btn: "診断開始",
            error_required: "必須項目を入力してください。",
            error_url: "有効なURLを入力してください。"
        },
        loading: {
            main: "Clinic.aiが入力情報をもとに詳細に分析しています。",
            sub: "少々お待ちください。",
            notice: "入力したURLを含む最大10ページを分析します。",
            step1: "ページ収集中",
            step2: "構造/メタ分析中",
            step3: "信頼性/FAQ分析中",
            step4: "レポート作成中"
        },
        result: {
            top_notice: "入力したURLを含む最大10ページをAIが分析して算出した結果です。",
            analyzed_pages: "分析ページ数",
            cta_title: "Clinic.aiでAI検索をいち早く先取りしましょう。",
            cta_btn: "相談・お問い合わせ",
            categories: {
                relevance: "診療科目の整合性",
                structure: "コンテンツの構造化",
                indexing: "メタ/インデックス衛生",
                trust: "信頼性シグナル(医療情報)",
                faq_schema: "FAQ・スキーマ準備度"
            },
            check_labels: {
                title_keyword: "Titleに診療科目を含む",
                h1_match: "H1一致",
                faq_count: "FAQ 5問以上"
            }
        }
    }
};
