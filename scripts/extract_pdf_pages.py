"""PDF 스냅샷에서 페이지별 텍스트를 추출해 JSON으로 저장합니다.

인용문 검증 테스트(tests/seed-integrity.test.ts)가 이 JSON을 원문 대조에 사용합니다.
테스트 자체는 추가 설치 없이 Node만으로 돌아가고, 이 스크립트는 원문이
바뀌었을 때만 다시 실행하면 됩니다.

사용:
    python scripts/extract_pdf_pages.py

필요 패키지: pypdf (없으면 `pip install pypdf`)
"""

import hashlib
import json
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "seed" / "travel-bsp" / "sources"

TARGETS = [
    ("SRC-001", "iata-bsp-manual-for-agents-2021-09-01.pdf"),
    ("SRC-003", "kifrs1115-principal-agent-agenda-decision-2022-05.pdf"),
]


def extract(source_id: str, file_name: str) -> None:
    pdf = SOURCES / file_name
    out = SOURCES / (pdf.stem + ".pages.json")

    data = pdf.read_bytes()
    digest = hashlib.sha256(data).hexdigest()

    reader = PdfReader(str(pdf))
    pages = {str(i): (page.extract_text() or "") for i, page in enumerate(reader.pages, start=1)}

    payload = {
        "source_id": source_id,
        "pdf_file": pdf.name,
        "pdf_sha256": digest,
        "page_count": len(reader.pages),
        "parser": "pypdf extract_text",
        "pages": pages,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{source_id}  sha256={digest}  pages={len(reader.pages)}  -> {out.name}")


def main() -> None:
    for source_id, file_name in TARGETS:
        extract(source_id, file_name)


if __name__ == "__main__":
    main()
