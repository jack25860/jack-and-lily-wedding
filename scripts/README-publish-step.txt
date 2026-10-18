      - name: Extract and rename (bytes untouched)
        run: |
          set -e
          python3 scripts/publish-originals.py /tmp/src.zip /tmp/out
          ls /tmp/out/*.jpg | wc -l