# A2A Framework Archive

**Archived**: December 2024
**Reason**: Replaced with Unified Multi-Provider Architecture

---

## What This Framework Was

The A2A (Agent-to-Agent) framework was a multi-agent system for network management that included:

- **828+ skills** across 5 specialist agents
- **Dynamic routing** based on query patterns and skill tags
- **Multi-agent collaboration** for cross-platform queries
- **Streaming support** with real-time SSE events

### Specialist Agents

| Agent | Skills | Purpose |
|-------|--------|---------|
| Meraki | 408 | Meraki Dashboard API (MX, MS, MR, MV, MT, SM) |
| Catalyst | 200+ | Cisco DNA Center / Catalyst Center |
| ThousandEyes | 100+ | Network monitoring and testing |
| Splunk | 50+ | Log analytics and SIEM |
| UI | 50+ | Dashboard visualization |

---

## Why It Was Archived

1. **Context Fragmentation**: Multi-agent design broke natural conversation flow
   - "Get VLANs for it" failed because agents didn't share context
   - Each agent had isolated memory

2. **Over-Engineering**: Complex orchestration for simple queries
   - Skill matching algorithm was imprecise
   - Wrong skills often selected

3. **Simpler Alternative Works Better**: Single-model approach with unified tools
   - One conversation, one model, full context
   - Natural language understanding without routing

---

## Framework Structure

```
src/a2a_archived/
├── Core Protocol
│   ├── types.py              # A2A Protocol v0.3 types
│   ├── registry.py           # Agent registry and routing
│   ├── enhanced_orchestrator.py  # Multi-agent coordination
│   ├── memory.py             # Conversation memory
│   └── collaboration.py      # Agent collaboration
│
├── Quality & Reliability
│   ├── response_quality.py   # Response scoring
│   ├── resilience.py         # Circuit breaker, rate limiting
│   ├── observability.py      # Distributed tracing
│   └── synthesis.py          # Response synthesis
│
├── Specialist Agents
│   ├── specialists/
│   │   ├── meraki_agent.py   # Meraki specialist (408 skills)
│   │   ├── catalyst_agent.py # Catalyst specialist (200+ skills)
│   │   ├── thousandeyes_agent.py
│   │   ├── splunk_agent.py
│   │   ├── ui_agent.py
│   │   └── [skill modules by platform]
│   └── base_specialist.py    # Base class for specialists
│
└── Supporting Systems
    ├── task_manager.py       # Task lifecycle
    ├── external_client.py    # Federation
    ├── push_notifications.py # Async notifications
    └── multi_turn_protocol.py # Conversation management
```

---

## How to Restore (If Needed)

If you want to restore the A2A framework:

1. Move contents back:
   ```bash
   mv src/a2a_archived/* src/a2a/
   ```

2. Update imports in `src/api/routes/agent_chat.py`

3. Re-enable the streaming endpoint

4. Test with:
   ```bash
   python -m pytest tests/integration/test_a2a_*.py
   ```

---

## Key Files for Reference

If porting skills to the new unified system, reference these files:

- **Skill Definitions**: `specialists/meraki/*.py` - Each has `get_skills()` method
- **Skill Handlers**: Same files have `execute()` and handler methods
- **Input Schemas**: Built with `build_input_schema()` helper
- **Entity Extraction**: `extract_*_entities()` functions

---

## Future Potential

This framework could be restored when:

1. **LLM context windows improve** - Better at managing multi-agent context
2. **Complex workflows needed** - Parallel execution across platforms
3. **Specialized expertise required** - Domain-specific agent fine-tuning
4. **Performance optimization** - Parallel tool execution

---

## Statistics

- **Total Code**: ~650KB Python
- **Core Modules**: 22 files
- **Specialist Modules**: 65+ files
- **Total Skills**: 828+
- **Development Time**: ~6 months
