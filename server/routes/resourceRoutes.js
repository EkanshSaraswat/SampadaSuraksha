const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const Resource = require('../models/Resource');
const ResourceAllocation = require('../models/ResourceAllocation');
const User = require('../models/User');

const populateResource = [
  { path: 'provider', select: 'name email role city state' },
  { path: 'ngo', select: 'name email city state' },
];

const populateAllocation = [
  { path: 'resource', select: 'name category quantity' },
  { path: 'rescueTeam', select: 'name email teamMembers' },
  { path: 'allocatedBy', select: 'name email' },
  { path: 'report', select: 'description status disasterType' },
];

async function getReservedMap(resourceIds) {
  const allocations = await ResourceAllocation.find({
    resource: { $in: resourceIds },
    status: 'allocated',
  }).select('resource quantity');

  const map = {};
  allocations.forEach((a) => {
    const id = a.resource.toString();
    map[id] = (map[id] || 0) + a.quantity;
  });
  return map;
}

function enrichResources(resources, reservedMap) {
  return resources.map((r) => {
    const id = r._id.toString();
    const reserved = reservedMap[id] || 0;
    const qty = r.quantity || 0;
    return {
      ...r.toObject(),
      reservedQuantity: reserved,
      availableQuantity: Math.max(0, qty - reserved),
    };
  });
}

/**
 * GET /api/resources/mine — Provider inventory with available vs reserved stock
 */
router.get('/mine', authenticate, requireRole('ResourceProvider'), async (req, res, next) => {
  try {
    const resources = await Resource.find({ provider: req.user.id, ngo: null })
      .sort({ category: 1, name: 1 });

    const reservedMap = await getReservedMap(resources.map((r) => r._id));
    const enriched = enrichResources(resources, reservedMap);

    res.json({
      success: true,
      count: enriched.length,
      resources: enriched,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resources/allocations — Provider: allocation history
 */
router.get('/allocations', authenticate, requireRole('ResourceProvider'), async (req, res, next) => {
  try {
    const allocations = await ResourceAllocation.find({ allocatedBy: req.user.id })
      .populate(populateAllocation)
      .sort({ createdAt: -1 });

    res.json({ success: true, count: allocations.length, allocations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resources/allocations/received — Rescue team: supplies allocated to them
 */
router.get(
  '/allocations/received',
  authenticate,
  requireRole('RescueTeam'),
  async (req, res, next) => {
    try {
      const allocations = await ResourceAllocation.find({
        rescueTeam: req.user.id,
        status: { $ne: 'cancelled' },
      })
        .populate(populateAllocation)
        .sort({ createdAt: -1 });

      res.json({ success: true, count: allocations.length, allocations });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/resources/allocate — Provider assigns stock to a rescue team
 */
router.post(
  '/allocate',
  authenticate,
  requireRole('ResourceProvider'),
  async (req, res, next) => {
    try {
      const { resourceId, teamId, quantity, notes, reportId } = req.body;

      if (!resourceId || !teamId || quantity == null) {
        res.status(400);
        throw new Error('resourceId, teamId, and quantity are required');
      }

      const qty = Number(quantity);
      if (Number.isNaN(qty) || qty < 1) {
        res.status(400);
        throw new Error('Quantity must be at least 1');
      }

      const resource = await Resource.findById(resourceId);
      if (!resource || resource.provider.toString() !== req.user.id) {
        res.status(404);
        throw new Error('Resource not found in your inventory');
      }

      const team = await User.findOne({ _id: teamId, role: 'RescueTeam' });
      if (!team) {
        res.status(404);
        throw new Error('Rescue team not found');
      }
      const approval = team.approvalStatus || 'approved';
      if (approval !== 'approved') {
        res.status(400);
        throw new Error('Only approved rescue teams can receive allocations');
      }

      const reservedMap = await getReservedMap([resource._id]);
      const reserved = reservedMap[resource._id.toString()] || 0;
      const available = (resource.quantity || 0) - reserved;

      if (qty > available) {
        res.status(400);
        throw new Error(`Only ${available} units available in stock`);
      }

      const allocation = await ResourceAllocation.create({
        resource: resourceId,
        rescueTeam: teamId,
        allocatedBy: req.user.id,
        quantity: qty,
        notes: (notes || '').trim(),
        report: reportId || null,
        status: 'allocated',
      });

      const populated = await ResourceAllocation.findById(allocation._id).populate(
        populateAllocation
      );

      res.status(201).json({
        success: true,
        message: `Allocated ${qty}× ${resource.name} to ${team.name}`,
        allocation: populated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/resources/allocations/:id — Provider updates allocation status
 */
router.patch(
  '/allocations/:id',
  authenticate,
  requireRole('ResourceProvider', 'RescueTeam'),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const allowed = ['allocated', 'delivered', 'cancelled'];
      if (!allowed.includes(status)) {
        res.status(400);
        throw new Error(`Status must be one of: ${allowed.join(', ')}`);
      }

      const allocation = await ResourceAllocation.findById(req.params.id).populate('resource');
      if (!allocation) {
        res.status(404);
        throw new Error('Allocation not found');
      }

      const isProvider = allocation.allocatedBy.toString() === req.user.id;
      const isTeam =
        req.user.role === 'RescueTeam' &&
        allocation.rescueTeam.toString() === req.user.id;

      if (req.user.role === 'ResourceProvider' && !isProvider) {
        res.status(403);
        throw new Error('Not your allocation');
      }
      if (req.user.role === 'RescueTeam' && !isTeam) {
        res.status(403);
        throw new Error('Not your allocation');
      }

      const prevStatus = allocation.status;

      if (req.user.role === 'RescueTeam' && status !== 'delivered') {
        res.status(403);
        throw new Error('Rescue teams can only mark allocations as delivered');
      }

      const resource = await Resource.findById(
        allocation.resource._id || allocation.resource
      );

      if (status === 'delivered' && prevStatus === 'allocated') {
        if (!resource) {
          res.status(404);
          throw new Error('Resource not found');
        }
        if (resource.quantity < allocation.quantity) {
          res.status(400);
          throw new Error('Insufficient stock to mark as delivered');
        }
        resource.quantity -= allocation.quantity;
        await resource.save();
      }

      if (status === 'cancelled' && prevStatus === 'delivered' && isProvider && resource) {
        resource.quantity += allocation.quantity;
        await resource.save();
      }

      if (prevStatus === 'cancelled' && status !== 'cancelled') {
        res.status(400);
        throw new Error('Cannot change a cancelled allocation');
      }

      allocation.status = status;
      await allocation.save();

      const populated = await ResourceAllocation.findById(allocation._id).populate(
        populateAllocation
      );

      res.json({ success: true, allocation: populated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/resources — ResourceProvider or NGO adds inventory
 */
router.post('/', authenticate, requireRole('ResourceProvider', 'NGO'), async (req, res, next) => {
  try {
    const { name, category, quantity } = req.body;

    if (!name || !category || quantity == null) {
      res.status(400);
      throw new Error('Please provide name, category, and quantity');
    }

    const payload = {
      name: name.trim(),
      category,
      quantity: Number(quantity),
      provider: req.user.id,
    };

    if (req.user.role === 'NGO') {
      payload.ngo = req.user.id;
    }

    const resource = await Resource.create(payload);
    const populated = await Resource.findById(resource._id).populate(populateResource);

    res.status(201).json({
      success: true,
      resource: populated,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stock', authenticate, requireRole('NGO'), async (req, res, next) => {
  try {
    const resources = await Resource.find({ ngo: req.user.id })
      .populate(populateResource)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: resources.length,
      resources,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/providers', authenticate, requireRole('NGO', 'Admin'), async (req, res, next) => {
  try {
    const providers = await User.find({ role: 'ResourceProvider' })
      .select('name email city state')
      .sort({ name: 1 });

    const resources = await Resource.find({ ngo: null })
      .populate('provider', 'name email role city state')
      .sort({ category: 1, name: 1 });

    const byProvider = providers.map((p) => {
      const pid = p._id.toString();
      const items = resources.filter(
        (r) => r.provider && r.provider._id.toString() === pid
      );
      const totalQty = items.reduce((sum, r) => sum + (r.quantity || 0), 0);
      return {
        provider: p,
        resources: items,
        totalQty,
        categories: [...new Set(items.map((r) => r.category))],
      };
    });

    res.json({
      success: true,
      count: byProvider.length,
      providers: byProvider.filter((g) => g.resources.length > 0 || g.provider),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const resources = await Resource.find()
      .populate(populateResource)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: resources.length,
      resources,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      res.status(404);
      throw new Error('Resource not found');
    }

    const isAdmin = req.user.role === 'Admin';
    const isProviderOwner =
      req.user.role === 'ResourceProvider' &&
      resource.provider.toString() === req.user.id;
    const isNgoOwner =
      req.user.role === 'NGO' &&
      resource.ngo &&
      resource.ngo.toString() === req.user.id;

    if (!isAdmin && !isProviderOwner && !isNgoOwner) {
      res.status(403);
      throw new Error('You can only update your own resources');
    }

    const { name, category, quantity } = req.body;

    if (name !== undefined) resource.name = name.trim();
    if (category !== undefined) resource.category = category;
    if (quantity !== undefined) {
      const newQty = Number(quantity);
      if (req.user.role === 'ResourceProvider' && !resource.ngo) {
        const reservedMap = await getReservedMap([resource._id]);
        const reserved = reservedMap[resource._id.toString()] || 0;
        if (newQty < reserved) {
          res.status(400);
          throw new Error(
            `Cannot set quantity below ${reserved} (currently allocated to teams)`
          );
        }
      }
      resource.quantity = newQty;
    }

    await resource.save();

    const populated = await Resource.findById(resource._id).populate(populateResource);

    res.json({
      success: true,
      resource: populated,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      res.status(404);
      throw new Error('Resource not found');
    }

    const isAdmin = req.user.role === 'Admin';
    const isProviderOwner =
      req.user.role === 'ResourceProvider' &&
      resource.provider.toString() === req.user.id;
    const isNgoOwner =
      req.user.role === 'NGO' &&
      resource.ngo &&
      resource.ngo.toString() === req.user.id;

    if (!isAdmin && !isProviderOwner && !isNgoOwner) {
      res.status(403);
      throw new Error('You can only delete your own resources');
    }

    const activeAlloc = await ResourceAllocation.countDocuments({
      resource: resource._id,
      status: 'allocated',
    });
    if (activeAlloc > 0) {
      res.status(400);
      throw new Error('Cancel active allocations before deleting this resource');
    }

    await Resource.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
