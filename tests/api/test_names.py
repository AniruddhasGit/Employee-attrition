from api.names import unique_names


def test_names_are_unique_and_deterministic():
    ids = list(range(1001, 2471))
    names = unique_names(ids)
    assert len(set(names.values())) == len(ids)
    assert unique_names(ids) == names
    assert all(len(n.split()) == 2 for n in names.values())
