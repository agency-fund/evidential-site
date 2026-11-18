The Experiments API connects your application to the experiments you design in [Evidential](https://app.evidential.dev/).
Your application asks Evidential which arm each participant is in and, for bandit experiments, reports the outcome it
observes.

## Authentication

Every request needs a data source API key in the `X-API-Key` header. Create and manage keys in Evidential under
**Settings**, in the **Data sources** section. Keys begin with `xat`.

```bash
curl https://api.evidential.dev/v1/experiments/<experiment_id> \
  --header 'X-API-Key: <your API key>'
```

## Choose your endpoints

Assignment works the same way for every experiment type: your application asks Evidential which arm a participant
belongs to. What differs is how outcomes reach Evidential:

- **Pull**: Evidential reads outcomes from your data source, and your application reports none.
- **Push**: your application reports each outcome by calling [Record an outcome](/api/outcomes/record/).

The endpoints you call depend on the experiment type:

- **Preassigned A/B** (pull): assignments are created when the experiment is designed.
  [List](/api/assignments/list/) or [export](/api/assignments/export-csv/) them all, or
  [look up one participant's](/api/assignments/retrieve/) at runtime.
- **Online A/B** (pull): [get or create an assignment](/api/assignments/retrieve/) as each participant arrives, or
  [assign with filters](/api/assignments/assign-with-filters/) if the experiment uses server-side filtering.
- **Multi-armed bandit, MAB** (push): [get or create an assignment](/api/assignments/retrieve/), then
  [record its outcome](/api/outcomes/record/).
- **MAB with a data warehouse outcome** (pull, `mab_online_dwh`): [get or create an
  assignment](/api/assignments/retrieve/). Evidential reads each outcome from the column bound to the experiment.
- **Contextual multi-armed bandit, CMAB** (push): [assign with context values](/api/assignments/assign-cmab/), then
  [record its outcome](/api/outcomes/record/).

To keep your own systems in sync with Evidential, [list the experiments on a data source](/api/experiments/list/) and
[get an experiment's design](/api/experiments/retrieve/).

## Errors

Branch on the HTTP status code, not on the text of the error message: status codes are stable, but message text may
change. `2xx` codes mean success, `4xx` codes usually mean a problem with your request, and `5xx` codes mean a
server-side error that may be retried.

## Retries

Retry only transient failures: network errors and `5xx` responses. Use exponential backoff with jitter, and cap the
number of attempts. Don't retry `4xx` responses; they fail again until you change the request, or until the
experiment, data source, or assignment changes. Assignment requests are safe to retry, because they return the existing
assignment when one was already created.
