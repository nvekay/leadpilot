# Extraction eval

30 labelled messages (5 languages, 5 currencies, spam, support, transactional mail, prompt injection attempts).
Models: claude-haiku-5-5 for extraction, claude-sonnet-5-5 for reply drafts. Run 2026-10-14.

| Field                        | Correct | Accuracy |
| ---------------------------- | ------- | -------- |
| category                     | 30/30   | 100%     |
| budget                       | 23/23   | 100%     |
| country                      | 17/17   | 100%     |
| language                     | 19/19   | 100%     |
| suspicious                   | 27/27   | 100%     |
| drafts passing safety checks | 19/19   | 100%     |

Total cost $0.0978 (≈ $0.0033 per message incl. draft), median 5.3 s per message.
