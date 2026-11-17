"""Utilitários para editar o campo `tune` das fases."""
def strip_tunes(b):
    while True:
        i = b.find('\n      tune: ')
        if i < 0: return b
        k = b.index('{', i); depth = 0
        for j in range(k, len(b)):
            if b[j] == '{': depth += 1
            elif b[j] == '}':
                depth -= 1
                if depth == 0: break
        j += 1
        if j < len(b) and b[j] == ',': j += 1
        b = b[:i] + b[j:]
