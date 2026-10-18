"""Calendar quarters as 'YYYY-Qn' labels."""

from datetime import date


def quarter_of(d: date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


def _parts(q: str) -> tuple[int, int]:
    year, n = q.split("-Q")
    return int(year), int(n)


def previous(q: str) -> str:
    year, n = _parts(q)
    return f"{year - 1}-Q4" if n == 1 else f"{year}-Q{n - 1}"


def history(current: str, closed: int = 3) -> list[str]:
    """The `closed` quarters before `current`, then `current`, oldest first."""
    out = [current]
    for _ in range(closed):
        out.append(previous(out[-1]))
    return out[::-1]
