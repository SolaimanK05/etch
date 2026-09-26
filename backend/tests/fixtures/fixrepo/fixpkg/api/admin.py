def purge(user_id: int) -> None:
    import fixpkg.db.repo

    fixpkg.db.repo.delete(user_id)
