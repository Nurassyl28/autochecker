# autochecker/reporter.py
import json
from typing import List, Dict, Optional

class Reporter:
    """Generates check result reports."""
    def __init__(self, student_alias: str, results: List[Dict], repo_url: str = None, llm_analysis: Optional[Dict] = None, task_title: Optional[str] = None):
        self._alias = student_alias
        self._results = results
        self._repo_url = repo_url
        self._llm_analysis = llm_analysis
        self._task_title = task_title

    def _get_summary(self):
        total = len(self._results)
        passed = sum(1 for r in self._results if r['status'] == 'PASS')
        failed = sum(1 for r in self._results if r['status'] == 'FAIL')
        errored = sum(1 for r in self._results if r['status'] == 'ERROR')
        score = (passed / total) * 100 if total > 0 else 0
        
        summary = {
            "student_alias": self._alias,
            "score": f"{score:.2f}%",
            "passed_checks": passed,
            "failed_checks": failed,
            "errored_checks": errored,
            "total_checks": total,
        }
        if self._llm_analysis:
            summary["llm_analysis"] = self._llm_analysis
        return summary

    def write_jsonl(self, output_dir: str):
        """Write detailed results to a .jsonl file."""
        summary = self._get_summary()
        lines = [json.dumps(summary)]
        for res in self._results:
            lines.append(json.dumps(res))

        filepath = f"{output_dir}/results.jsonl"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"📄 Detailed report for {self._alias} written to {filepath}")

    def write_html(self, output_dir: str):
        """Generate a simple HTML report."""
        summary = self._get_summary()

        if self._repo_url:
            title = f"<h1>Report for: <a href='{self._repo_url}' target='_blank'>{self._alias}</a> - {summary['score']}</h1>"
        else:
            title = f"<h1>Report for: {self._alias} - {summary['score']}</h1>"

        html = title

        if self._llm_analysis:
            html += "<h2>🤖 LLM Analysis</h2>"
            html += f"<p><b>Verdict:</b> {self._llm_analysis.get('verdict', 'no data')}</p>"

            if self._llm_analysis.get('task_analysis'):
                html += "<h3>Detailed task analysis:</h3>"
                for task in self._llm_analysis['task_analysis']:
                    html += f"<div style='margin-bottom: 20px; border-left: 3px solid #ccc; padding-left: 10px;'>"
                    html += f"<h4>Task {task.get('task_number', '?')}: {task.get('task_name', 'Unknown task')}</h4>"
                    html += f"<p><b>Result:</b> {task.get('result', 'N/A')}</p>"
                    html += f"<p><b>Reasoning:</b> {task.get('argumentation', 'No reasoning')}</p>"
                    if task.get('quotes'):
                        html += f"<p><b>Quotes:</b> {task.get('quotes')}</p>"
                    if task.get('link'):
                        html += f"<p><b>Link:</b> <a href='{task.get('link')}' target='_blank'>{task.get('link')}</a></p>"
                    html += "</div>"

            if self._llm_analysis.get('reasons'):
                html += "<h3>Overall reasoning:</h3><ul>"
                for reason in self._llm_analysis['reasons']:
                    html += f"<li>{reason}</li>"
                html += "</ul>"
            if self._llm_analysis.get('quotes'):
                html += "<h3>Quotes from submission:</h3><blockquote>"
                for quote in self._llm_analysis['quotes']:
                    html += f"<p><i>\"{quote}\"</i></p>"
                html += "</blockquote>"

        html += "<h2>⚙️ Check Results</h2>"
        html += "<ul>"
        html += f"<li>✅ Passed: {summary['passed_checks']}</li>"
        html += f"<li>❌ Failed: {summary['failed_checks']}</li>"
        html += f"<li>⚠️ Errors: {summary['errored_checks']}</li>"
        html += "</ul>"
        html += "<h3>Details:</h3><table border='1' style='border-collapse: collapse; width: 100%;'>"
        html += "<tr><th>ID</th><th>Type</th><th>Status</th><th>Description</th><th>Feedback</th></tr>"

        for res in self._results:
            status_icon = "✅" if res['status'] == 'PASS' else "❌" if res['status'] == 'FAIL' else "⚠️"
            description = res.get('description', '')
            details = res.get('details', '')

            is_llm_check = res.get('score') is not None or res.get('reasons') is not None
            check_type = "🤖 LLM" if is_llm_check else "⚙️ Code"

            llm_extra = ""
            if is_llm_check:
                score = res.get('score', '-')
                min_score = res.get('min_score', '-')
                llm_extra = f"Score: {score}/5 (min: {min_score})"
                reasons = res.get('reasons', [])
                if reasons:
                    llm_extra += f"<br><small><b>Reasons:</b> {'; '.join(str(r) for r in reasons[:3])}</small>"
                quotes = res.get('quotes', [])
                if quotes:
                    quote_texts = []
                    for q in quotes[:2]:
                        if isinstance(q, dict):
                            quote_texts.append(q.get('text', str(q))[:100])
                        else:
                            quote_texts.append(str(q)[:100])
                    if quote_texts:
                        llm_extra += f"<br><small><b>Quotes:</b> {'; '.join(quote_texts)}</small>"

            parts = []
            short_reason = (res.get('short_reason') or '').strip()
            detailed_reason = (res.get('detailed_reason') or details or '').strip()
            likely_cause = (res.get('likely_cause') or '').strip()
            next_steps = res.get('next_steps') or []
            hint = (res.get('hint') or '').strip()
            escalation_state = (res.get('escalation_state') or 'none').strip()

            if res['status'] != 'PASS':
                if short_reason:
                    parts.append(f"<b>What failed:</b> {short_reason}")
                if detailed_reason and detailed_reason != short_reason:
                    parts.append(f"<b>Details:</b> {detailed_reason}")
                if likely_cause:
                    parts.append(f"<b>Likely cause:</b> {likely_cause}")
                if next_steps:
                    steps_html = "".join(f"<li>{s}</li>" for s in next_steps)
                    parts.append(f"<b>Next steps:</b><ul>{steps_html}</ul>")
                if hint:
                    parts.append(f"<b>Hint:</b> {hint}")
                if escalation_state and escalation_state != 'none':
                    parts.append(f"<small><i>Escalation: {escalation_state}</i></small>")
            else:
                if short_reason:
                    parts.append(short_reason)
                elif detailed_reason:
                    parts.append(detailed_reason)

            if llm_extra:
                parts.append(llm_extra)

            feedback_html = "<br>".join(parts) if parts else "-"
            details_cell = f"<td style='max-width: 500px; word-wrap: break-word;'>{feedback_html}</td>"
            html += f"<tr><td>{res['id']}</td><td>{check_type}</td><td>{status_icon} {res['status']}</td><td>{description}</td>{details_cell}</tr>"

        html += "</table>"

        filepath = f"{output_dir}/summary.html"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"📈 HTML report for {self._alias} written to {filepath}")

    def write_student_report(self, output_dir: str):
        """Generates a student-friendly text report showing all checks."""
        summary = self._get_summary()
        passed = summary['passed_checks']
        failed = summary['failed_checks']
        total = summary['total_checks']

        lines = []
        if self._task_title:
            lines.append(self._task_title)
            lines.append("")
        lines.append(f"Score: {summary['score']} ({passed}/{total} checks passed)")
        lines.append("")

        for res in self._results:
            is_llm = res.get('score') is not None or res.get('reasons') is not None
            description = res.get('description', res.get('id', ''))

            if res['status'] == 'PASS':
                if is_llm:
                    score = res.get('score', '?')
                    lines.append(f"  ✅ {description} ({score}/5)")
                    reasons = res.get('reasons', [])
                    if reasons:
                        for reason in reasons:
                            lines.append(f"    + {reason}")
                    lines.append("")
                else:
                    lines.append(f"  ✅ {description}")
            else:
                icon = "❌" if res['status'] == 'FAIL' else "⚠️"
                if is_llm:
                    score = res.get('score', '?')
                    min_score = res.get('min_score', '?')
                    lines.append(f"  {icon} {description} ({score}/5, needs {min_score})")
                else:
                    lines.append(f"  {icon} {description}")

                short_reason = (res.get('short_reason') or '').strip()
                detailed_reason = (res.get('detailed_reason') or res.get('details') or '').strip()
                likely_cause = (res.get('likely_cause') or '').strip()
                next_steps = res.get('next_steps') or []
                hint = (res.get('hint') or '').strip()
                escalation_state = (res.get('escalation_state') or 'none').strip()

                if short_reason:
                    lines.append(f"    What failed: {short_reason}")
                if detailed_reason and detailed_reason != short_reason:
                    lines.append(f"    Details: {detailed_reason[:2000]}")
                if likely_cause:
                    lines.append(f"    Likely cause: {likely_cause}")
                if next_steps:
                    lines.append("    Next steps:")
                    for step in next_steps:
                        lines.append(f"      - {step}")
                if hint:
                    for hint_line in hint.split('\n'):
                        lines.append(f"    Hint: {hint_line.strip()}")

                # Show LLM reasons if available
                reasons = res.get('reasons', [])
                if reasons:
                    for reason in reasons:
                        lines.append(f"    - {reason}")

                if escalation_state and escalation_state != 'none':
                    lines.append(f"    (escalation: {escalation_state})")

                lines.append("")

        if failed == 0:
            lines.append("")
            lines.append("All checks passed! ✨")

        report_text = "\n".join(lines)
        filepath = f"{output_dir}/student_report.txt"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(report_text)
        print(f"📋 Student report for {self._alias} written to {filepath}")

    def write_failure_report(self, output_dir: str, message: str):
        """Generate an HTML report for a complete check failure."""
        html = f"<h1>❌ Check failed for: {self._alias}</h1>"
        html += f"<br><p>{message}</p>"

        filepath = f"{output_dir}/summary.html"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"📈 Failure report for {self._alias} written to {filepath}")
