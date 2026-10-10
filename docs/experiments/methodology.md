# Experiment methodology

The in-product policy evaluation uses the real headless simulation core.

1. Four held-out seeds are selected: `101`, `307`, `911`, and `1217`.
2. Random-valid and need-heuristic policies run for 420 ticks from identical configurations.
3. Q-learning agents first train for 1,800 ticks on shifted training seeds with epsilon exploration.
4. Learned Q tables are transferred by stable agent profile into fresh held-out worlds.
5. Evaluation runs with exploration disabled.
6. Satisfaction, per-tick reward, and hunger are averaged across the four runs.

This is a small engineering experiment, not evidence about human societies. The heuristic is deliberately strong and remains the best policy in the current benchmark. The learned policy improves reward and satisfaction over random-valid behavior but still has worse hunger control; that limitation is visible rather than hidden.

Controlled city interventions change only explicit state:

- Food scarcity reduces market inventory to 18%.
- Labor contraction removes one third of jobs.
- Price shock raises food cost and lowers wages.
- Social isolation probabilistically removes interaction opportunities.

The event log records each intervention at its simulation tick.
