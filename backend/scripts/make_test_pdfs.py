from __future__ import annotations

from pathlib import Path

import fitz


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "tmp"
    out_dir.mkdir(parents=True, exist_ok=True)

    resume_pdf = out_dir / "resume.pdf"
    job_pdf = out_dir / "job.pdf"

    _write_pdf(
        resume_pdf,
        "John Doe\n\nSkills: Python, FastAPI, SQL\nExperience: 5 years\nDomains: fintech\nProjects: Resume Parser\nEducation: BSc Computer Science",
    )
    _write_pdf(
        job_pdf,
        "Backend Engineer\n\nRequired skills: Python, SQL\nPreferred skills: FastAPI\nMinimum years experience: 3\nDomain: fintech\nRequired education: BSc",
    )

    print(str(resume_pdf))
    print(str(job_pdf))


def _write_pdf(path: Path, text: str) -> None:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()


if __name__ == "__main__":
    main()

